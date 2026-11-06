const router=require('express').Router();
const {pool,query}=require('../db');
const {auth,admin}=require('../middleware');
const bcrypt=require('bcryptjs');
const multer=require('multer');
const {upload,remove}=require('../storage/r2');

const storage=multer({
 storage:multer.memoryStorage(),
 limits:{fileSize:5*1024*1024},
 fileFilter:(req,file,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const owner=[auth,admin];
const notify=(uid,title,body,type,id)=>query(
 'INSERT INTO notifications(user_id,title,body,related_type,related_id) VALUES($1,$2,$3,$4,$5)',
 [uid,title,body,type,id]
);

// ==========================================
// PUBLIC CATALOGUE
// ==========================================

router.get('/public/products',wrap(async(req,res)=>{
 const {q='',category='',sort='newest',minPrice,maxPrice,stock='',tag=''}=req.query;
 const vals=[];
 const add=v=>{vals.push(v);return `$${vals.length}`};
 const w=['p.is_hidden=FALSE'];

 if(q){
  const x=add('%'+String(q).slice(0,100)+'%');
  w.push(`(p.name ILIKE ${x} OR p.description ILIKE ${x} OR c.name ILIKE ${x} OR array_to_string(p.manual_tags,' ') ILIKE ${x})`);
 }
 if(category)w.push(`c.name=${add(category)}`);
 if(minPrice!==undefined&&minPrice!=='')w.push(`p.price>=${add(Number(minPrice))}`);
 if(maxPrice!==undefined&&maxPrice!=='')w.push(`p.price<=${add(Number(maxPrice))}`);
 if(stock==='in')w.push('p.stock_quantity>0 AND p.is_available');
 if(stock==='out')w.push('(p.stock_quantity=0 OR NOT p.is_available)');
 if(tag==='new')w.push("p.created_at>=NOW()-INTERVAL '7 days'");
 if(tag==='discount')w.push("EXISTS(SELECT 1 FROM offer_products op JOIN offers o ON o.id=op.offer_id WHERE op.product_id=p.id AND NOT o.is_hidden AND NOW() BETWEEN o.starts_at AND o.ends_at)");

 const orders={
  newest:'p.created_at DESC',
  'price-low':'p.price ASC',
  'price-high':'p.price DESC',
  liked:'likes_count DESC,p.created_at DESC'
 };
 const order=orders[sort]||orders.newest;

 const r=await query(`SELECT p.*,c.name category_name,
 (SELECT COUNT(*)::int FROM product_likes l WHERE l.product_id=p.id) likes_count,
 EXISTS(SELECT 1 FROM offers o JOIN offer_products op ON op.offer_id=o.id WHERE op.product_id=p.id AND NOT o.is_hidden AND NOW() BETWEEN o.starts_at AND o.ends_at) has_discount
 FROM products p LEFT JOIN categories c ON c.id=p.category_id
 WHERE ${w.join(' AND ')}
 ORDER BY p.featured DESC, ${order} LIMIT 250`,vals);

 res.json({products:r.rows});
}));

// Public categories - customer storefront
router.get('/public/categories',wrap(async(req,res)=>{
 const r=await query(
  'SELECT id,name,icon,image_url,sort_order FROM categories WHERE is_active=TRUE ORDER BY sort_order,name'
 );
 res.json({categories:r.rows});
}));

router.get('/public/offers',wrap(async(req,res)=>{
 const r=await query("SELECT o.*,COALESCE(array_agg(op.product_id) FILTER(WHERE op.product_id IS NOT NULL),'{}') product_ids FROM offers o LEFT JOIN offer_products op ON op.offer_id=o.id WHERE NOT o.is_hidden AND NOW() BETWEEN o.starts_at AND o.ends_at GROUP BY o.id ORDER BY o.ends_at");
 res.json({offers:r.rows});
}));

router.get('/public/settings',wrap(async(req,res)=>{
 const r=await query('SELECT key,value FROM shop_settings');
 res.json({settings:Object.fromEntries(r.rows.map(x=>[x.key,x.value]))});
}));

router.get('/public/notices',wrap(async(req,res)=>{
 const r=await query('SELECT id,title,body,created_at FROM notices WHERE is_published ORDER BY created_at DESC LIMIT 100');
 res.json({notices:r.rows});
}));

router.get('/public/suggestions',wrap(async(req,res)=>{
 const r=await query("SELECT s.id,s.title,s.details,s.owner_reply,s.created_at,(SELECT COUNT(*)::int FROM suggestion_likes l WHERE l.suggestion_id=s.id) likes_count FROM suggestions s WHERE s.public_status='published' ORDER BY s.created_at DESC");
 res.json({suggestions:r.rows});
}));

router.get('/public/reviews',wrap(async(req,res)=>{
 const r=await query('SELECT id,reviewer_name,body,created_at FROM shop_reviews WHERE is_visible ORDER BY created_at DESC LIMIT 200');
 res.json({reviews:r.rows});
}));

router.post('/shop/reviews',auth,wrap(async(req,res)=>{
 const body=String(req.body.body||'').trim();
 if(body.length<3||body.length>1500)return res.status(400).json({error:'Review must be 3–1500 characters.'});
 const r=await query('INSERT INTO shop_reviews(user_id,reviewer_name,body) SELECT id,name,$2 FROM users WHERE id=$1 RETURNING *',[req.user.id,body]);
 res.status(201).json({review:r.rows[0]});
}));

// ==========================================
// AUTHENTICATION
// ==========================================

router.get('/auth/me',auth,wrap(async(req,res)=>{
 const r=await query('SELECT id,name,email,role FROM users WHERE id=$1 AND is_active=TRUE',[req.user.id]);
 if(!r.rowCount)return res.status(401).json({error:'Account unavailable'});
 res.json({user:r.rows[0]});
}));

router.post('/auth/register',wrap(async(req,res)=>{
 const name=String(req.body.name||'').trim();
 const email=String(req.body.email||'').trim().toLowerCase();
 const password=String(req.body.password||'');

 if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8){
  return res.status(400).json({error:'Enter a valid name, email and password (at least 8 characters).'});
 }

 const hash=await bcrypt.hash(password,12);
 const r=await query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',[name,email,hash]);
 res.status(201).json({user:r.rows[0]});
}));

router.post('/auth/login',wrap(async(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase();
 const password=String(req.body.password||'');
 const r=await query('SELECT id,name,email,password_hash,role,is_active FROM users WHERE email=$1',[email]);
 const u=r.rows[0];

 if(!u||!u.is_active||!await bcrypt.compare(password,u.password_hash)){
  return res.status(401).json({error:'Invalid email or password.'});
 }

 const jwt=require('jsonwebtoken');
 const token=jwt.sign({id:u.id,role:u.role},process.env.JWT_SECRET,{
  expiresIn:process.env.JWT_EXPIRES_IN||'7d'
 });

 res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role}});
}));

// Duplicate /auth/me route removed. Keep only the active-account check above.

// ==========================================
// CUSTOMER INTERACTIONS
// ==========================================

router.post('/products/:id/like',auth,wrap(async(req,res)=>{
 await query('INSERT INTO product_likes(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,req.params.id]);
 const count=await query('SELECT COUNT(*)::int AS likes_count FROM product_likes WHERE product_id=$1',[req.params.id]);
 res.json({liked:true,likes_count:count.rows[0].likes_count});
}));

router.delete('/products/:id/like',auth,wrap(async(req,res)=>{
 await query('DELETE FROM product_likes WHERE user_id=$1 AND product_id=$2',[req.user.id,req.params.id]);
 const count=await query('SELECT COUNT(*)::int AS likes_count FROM product_likes WHERE product_id=$1',[req.params.id]);
 res.json({liked:false,likes_count:count.rows[0].likes_count});
}));

router.post('/products/:id/favourite',auth,wrap(async(req,res)=>{
 await query('INSERT INTO favourites(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,req.params.id]);
 res.json({favourite:true});
}));

router.delete('/products/:id/favourite',auth,wrap(async(req,res)=>{
 await query('DELETE FROM favourites WHERE user_id=$1 AND product_id=$2',[req.user.id,req.params.id]);
 res.json({favourite:false});
}));

router.get('/customer/favourites',auth,wrap(async(req,res)=>{
 const r=await query('SELECT p.* FROM favourites f JOIN products p ON p.id=f.product_id WHERE f.user_id=$1 AND NOT p.is_hidden ORDER BY f.created_at DESC',[req.user.id]);
 res.json({products:r.rows});
}));

router.get('/customer/dashboard',auth,wrap(async(req,res)=>{
 const [n,r]=await Promise.all([
  query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]),
  query('SELECT r.*,p.name product_name FROM reservations r JOIN products p ON p.id=r.product_id WHERE r.user_id=$1 ORDER BY r.created_at DESC',[req.user.id])
 ]);
 res.json({notifications:n.rows,reservations:r.rows});
}));

router.patch('/customer/notifications/:id/read',auth,wrap(async(req,res)=>{
 const r=await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);
 res.json({ok:!!r.rowCount});
}));

router.post('/customer/suggestions',auth,wrap(async(req,res)=>{
 const title=String(req.body.title||'').trim();
 const details=String(req.body.details||'').trim();
 if(!title)return res.status(400).json({error:'Product name is required.'});
 const r=await query('INSERT INTO suggestions(user_id,title,details) VALUES($1,$2,$3) RETURNING *',[req.user.id,title,details]);
 res.status(201).json({suggestion:r.rows[0]});
}));

router.post('/customer/suggestions/:id/like',auth,wrap(async(req,res)=>{
 const x=await query('SELECT 1 FROM suggestion_likes WHERE user_id=$1 AND suggestion_id=$2',[req.user.id,req.params.id]);
 if(x.rowCount)await query('DELETE FROM suggestion_likes WHERE user_id=$1 AND suggestion_id=$2',[req.user.id,req.params.id]);
 else await query('INSERT INTO suggestion_likes(user_id,suggestion_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,req.params.id]);
 res.json({liked:!x.rowCount});
}));
// ==========================================
// PICKUP RESERVATIONS
// Pending requests do not reduce stock.
// ==========================================

router.post('/reservations',auth,wrap(async(req,res)=>{
 const productId=req.body.productId;
 const quantity=Number(req.body.quantity||1);

 if(!Number.isInteger(quantity)||quantity<1||quantity>30){
  return res.status(400).json({error:'Choose a quantity from 1 to 30.'});
 }

 const p=await query('SELECT id FROM products WHERE id=$1 AND NOT is_hidden AND is_available',[productId]);
 if(!p.rowCount)return res.status(404).json({error:'Product unavailable.'});

 const r=await query("INSERT INTO reservations(user_id,product_id,quantity) VALUES($1,$2,$3) RETURNING *",[req.user.id,productId,quantity]);
 res.status(201).json({reservation:r.rows[0],message:'Pickup request sent. Wait for owner approval.'});
}));

router.post('/reservations/:id/cancel',auth,wrap(async(req,res)=>{
 const c=await pool.connect();

 try{
  await c.query('BEGIN');

  const r=await c.query('SELECT * FROM reservations WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.user.id]);

  if(!r.rowCount){
   await c.query('ROLLBACK');
   return res.status(404).json({error:'Reservation not found.'});
  }

  const x=r.rows[0];

  if(x.status==='Reserved'){
   await c.query('ROLLBACK');
   return res.status(409).json({error:'Approved reservations cannot be cancelled online. Contact the shop.'});
  }

  if(x.status!=='Request Sent'){
   await c.query('ROLLBACK');
   return res.status(409).json({error:'This request can no longer be cancelled.'});
  }

  await c.query("UPDATE reservations SET status='Cancelled',updated_at=NOW() WHERE id=$1",[x.id]);
  await c.query('COMMIT');

  res.json({status:'Cancelled'});
 }catch(e){
  await c.query('ROLLBACK');
  throw e;
 }finally{
  c.release();
 }
}));

// ==========================================
// OWNER DASHBOARD AND PRODUCT MANAGEMENT
// ==========================================

router.get('/owner/summary',...owner,wrap(async(req,res)=>{
 const r=await query(`SELECT
 (SELECT COUNT(*)::int FROM products WHERE NOT is_hidden) products,
 (SELECT COUNT(*)::int FROM reservations WHERE status='Request Sent') pending,
 (SELECT COUNT(*)::int FROM suggestions WHERE public_status='private') suggestions,
 (SELECT COUNT(*)::int FROM offers WHERE NOT is_hidden AND NOW() BETWEEN starts_at AND ends_at) offers`);
 res.json(r.rows[0]);
}));

// Upload product image to Cloudflare R2
router.post('/owner/products/:id/image',...owner,storage.single('image'),wrap(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Choose an image (JPG, PNG, WEBP or GIF), max 5 MB.'});

 const key=`products/${Date.now()}-${require('crypto').randomUUID()}`;
 const url=await upload(key,req.file.buffer,req.file.mimetype);
 const old=await query('SELECT image_key FROM products WHERE id=$1',[req.params.id]);

 if(!old.rowCount){
  await remove(key);
  return res.status(404).json({error:'Product not found.'});
 }

 await query('UPDATE products SET image_key=$2,image_url=$3,updated_at=NOW() WHERE id=$1',[req.params.id,key,url]);

 if(old.rows[0].image_key)await remove(old.rows[0].image_key).catch(console.error);

 res.json({imageUrl:url});
}));

// Delete product image
router.delete('/owner/products/:id/image',...owner,wrap(async(req,res)=>{
 const old=await query('SELECT image_key FROM products WHERE id=$1',[req.params.id]);
 if(!old.rowCount)return res.status(404).json({error:'Product not found.'});

 await query('UPDATE products SET image_key=NULL,image_url=NULL,updated_at=NOW() WHERE id=$1',[req.params.id]);

 if(old.rows[0].image_key)await remove(old.rows[0].image_key).catch(console.error);

 res.json({deleted:true});
}));

// Shop review moderation
router.get('/owner/reviews',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT * FROM shop_reviews ORDER BY created_at DESC');
 res.json({reviews:r.rows});
}));

router.patch('/owner/reviews/:id',...owner,wrap(async(req,res)=>{
 const r=await query('UPDATE shop_reviews SET is_visible=$2 WHERE id=$1 RETURNING id,is_visible',[req.params.id,!!req.body.isVisible]);
 res.json({review:r.rows[0]||null});
}));

router.delete('/owner/reviews/:id',...owner,wrap(async(req,res)=>{
 await query('DELETE FROM shop_reviews WHERE id=$1',[req.params.id]);
 res.json({deleted:true});
}));

// Product list, create, update and hide
router.get('/owner/products',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT * FROM products ORDER BY created_at DESC');
 res.json({products:r.rows});
}));

router.post('/owner/products',...owner,wrap(async(req,res)=>{
 const {name,description='',price,categoryId,stockQuantity=0,tags=[]}=req.body;

 if(!String(name||'').trim()||!Number.isFinite(+price)||+price<0||!Number.isInteger(+stockQuantity)||+stockQuantity<0){
  return res.status(400).json({error:'Check product name, price and stock.'});
 }

 const r=await query('INSERT INTO products(name,description,price,category_id,stock_quantity,manual_tags) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[name.trim(),description,+price,categoryId||null,+stockQuantity,Array.isArray(tags)?tags:[]]);

 res.status(201).json({product:r.rows[0]});
}));

router.patch('/owner/products/:id',...owner,wrap(async(req,res)=>{
 const b=req.body;
 const fields={
  name:'name',
  description:'description',
  price:'price',
  categoryId:'category_id',
  stockQuantity:'stock_quantity',
  isHidden:'is_hidden',
  isAvailable:'is_available',
  featured:'featured',
  tags:'manual_tags'
 };

 const sets=[],vals=[];

 for(const [k,col] of Object.entries(fields)){
  if(b[k]!==undefined){
   vals.push(k==='tags'?(Array.isArray(b[k])?b[k]:[]):b[k]);
   sets.push(`${col}=$${vals.length}`);
  }
 }

 if(!sets.length)return res.status(400).json({error:'No fields supplied.'});

 vals.push(req.params.id);

 const r=await query(`UPDATE products SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);

 if(!r.rowCount)return res.status(404).json({error:'Product not found.'});

 res.json({product:r.rows[0]});
}));

router.delete('/owner/products/:id',...owner,wrap(async(req,res)=>{
 const r=await query('UPDATE products SET is_hidden=TRUE,updated_at=NOW() WHERE id=$1 RETURNING id',[req.params.id]);
 res.json({hidden:!!r.rowCount});
}));

// ==========================================
// OWNER RESERVATION MANAGEMENT
// ==========================================

router.get('/owner/reservations',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT r.*,u.name customer_name,u.email,p.name product_name FROM reservations r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC');
 res.json({reservations:r.rows});
}));

router.post('/owner/reservations/:id/decision',...owner,wrap(async(req,res)=>{
 const c=await pool.connect();

 try{
  await c.query('BEGIN');

  const rr=await c.query('SELECT * FROM reservations WHERE id=$1 FOR UPDATE',[req.params.id]);

  if(!rr.rowCount){
   await c.query('ROLLBACK');
   return res.status(404).json({error:'Not found'});
  }

  const r=rr.rows[0];

  if(r.status!=='Request Sent'){
   await c.query('ROLLBACK');
   return res.status(409).json({error:'Request is no longer pending.'});
  }

  if(req.body.decision==='approve'){
   const p=await c.query('SELECT stock_quantity FROM products WHERE id=$1 FOR UPDATE',[r.product_id]);

   if(!p.rowCount||p.rows[0].stock_quantity<r.quantity){
    await c.query("UPDATE reservations SET status='Stock Unavailable' WHERE id=$1",[r.id]);
    await c.query("INSERT INTO notifications(user_id,title,body,related_type,related_id) VALUES($1,'Stock unavailable','The requested quantity is no longer available.','reservation',$2)",[r.user_id,r.id]);
    await c.query('COMMIT');
    return res.status(409).json({error:'Insufficient stock.'});
   }

   await c.query('UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2',[r.quantity,r.product_id]);
   await c.query("UPDATE reservations SET status='Reserved',expires_at=NOW()+INTERVAL '24 hours',updated_at=NOW() WHERE id=$1",[r.id]);
   await c.query("INSERT INTO notifications(user_id,title,body,related_type,related_id) VALUES($1,'Reservation approved','Your item is reserved for physical pickup for 24 hours. Pay at the shop.','reservation',$2)",[r.user_id,r.id]);

  }else if(req.body.decision==='decline'){
   await c.query("UPDATE reservations SET status='Declined',decline_reason=$2 WHERE id=$1",[r.id,String(req.body.reason||'')]);
   await c.query('INSERT INTO notifications(user_id,title,body,related_type,related_id) VALUES($1,$2,$3,$4,$5)',[r.user_id,'Reservation declined',String(req.body.reason||'Your request was declined.'),'reservation',r.id]);

  }else{
   await c.query('ROLLBACK');
   return res.status(400).json({error:'Decision must be approve or decline.'});
  }

  await c.query('COMMIT');
  res.json({ok:true});

 }catch(e){
  await c.query('ROLLBACK');
  throw e;
 }finally{
  c.release();
 }
}));

router.post('/owner/reservations/:id/cancel',...owner,wrap(async(req,res)=>{
 const c=await pool.connect();

 try{
  await c.query('BEGIN');

  const r=await c.query("SELECT * FROM reservations WHERE id=$1 AND status='Reserved' FOR UPDATE",[req.params.id]);

  if(!r.rowCount){
   await c.query('ROLLBACK');
   return res.status(409).json({error:'Only active reservations can be cancelled.'});
  }

  const x=r.rows[0];

  await c.query('UPDATE products SET stock_quantity=stock_quantity+$1 WHERE id=$2',[x.quantity,x.product_id]);
  await c.query("UPDATE reservations SET status='Cancelled',updated_at=NOW() WHERE id=$1",[x.id]);
  await c.query('COMMIT');

  await notify(x.user_id,'Reservation cancelled','The shop cancelled your pickup reservation.','reservation',x.id);

  res.json({ok:true});

 }catch(e){
  await c.query('ROLLBACK');
  throw e;
 }finally{
  c.release();
 }
}));

router.post('/owner/reservations/:id/complete',...owner,wrap(async(req,res)=>{
 const r=await query("UPDATE reservations SET status='Completed',updated_at=NOW() WHERE id=$1 AND status='Reserved' RETURNING product_id,quantity,user_id",[req.params.id]);

 if(!r.rowCount)return res.status(409).json({error:'Only reserved pickups can be completed.'});

 await query('UPDATE products SET completed_sales=completed_sales+$1 WHERE id=$2',[r.rows[0].quantity,r.rows[0].product_id]);
 await notify(r.rows[0].user_id,'Pickup completed','Your pickup has been marked complete. Thank you!','reservation',req.params.id);

 res.json({ok:true});
}));

// ==========================================
// OWNER SUGGESTIONS AND OFFERS
// ==========================================

router.get('/owner/suggestions',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT s.*,u.name customer_name FROM suggestions s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC');
 res.json({suggestions:r.rows});
}));

router.post('/owner/suggestions',...owner,wrap(async(req,res)=>{
 const title=String(req.body.title||'').trim();
 const details=String(req.body.details||'').trim();

 if(!title)return res.status(400).json({error:'Suggestion title is required.'});

 const r=await query("INSERT INTO suggestions(user_id,title,details,public_status) VALUES(NULL,$1,$2,'published') RETURNING *",[title,details]);
 res.status(201).json({suggestion:r.rows[0]});
}));

router.delete('/owner/suggestions/:id',...owner,wrap(async(req,res)=>{
 await query('DELETE FROM suggestions WHERE id=$1',[req.params.id]);
 res.json({deleted:true});
}));

router.patch('/owner/suggestions/:id',...owner,wrap(async(req,res)=>{
 const {reply='',status='private'}=req.body;

 if(!['private','published','hidden'].includes(status)){
  return res.status(400).json({error:'Invalid visibility'});
 }

 const r=await query('UPDATE suggestions SET owner_reply=$2,public_status=$3,updated_at=NOW() WHERE id=$1 RETURNING *',[req.params.id,reply,status]);

 if(!r.rowCount)return res.status(404).json({error:'Suggestion not found'});

 if(r.rows[0].user_id)await notify(r.rows[0].user_id,'Suggestion update',reply||'The owner updated your suggestion.','suggestion',req.params.id);

 res.json({suggestion:r.rows[0]});
}));

router.get('/owner/offers',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT * FROM offers ORDER BY created_at DESC');
 res.json({offers:r.rows});
}));

router.post('/owner/offers',...owner,wrap(async(req,res)=>{
 const {title,description='',discountType='percent',discountValue,startsAt,endsAt,productIds=[]}=req.body;

 if(!title||!['percent','fixed'].includes(discountType)||+discountValue<=0||(discountType==='percent'&&+discountValue>100)||new Date(endsAt)<=new Date(startsAt)){
  return res.status(400).json({error:'Invalid offer details.'});
 }

 const c=await pool.connect();

 try{
  await c.query('BEGIN');

  const r=await c.query('INSERT INTO offers(title,description,discount_type,discount_value,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[title,description,discountType,discountValue,startsAt,endsAt]);

  for(const id of productIds){
   await c.query('INSERT INTO offer_products(offer_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.rows[0].id,id]);
  }

  await c.query('COMMIT');
  res.status(201).json({offer:r.rows[0]});

 }catch(e){
  await c.query('ROLLBACK');
  throw e;
 }finally{
  c.release();
 }
}));

router.delete('/owner/offers/:id',...owner,wrap(async(req,res)=>{
 await query('UPDATE offers SET is_hidden=TRUE WHERE id=$1',[req.params.id]);
 res.json({hidden:true});
}));
// ==========================================
// OWNER CATEGORY MANAGEMENT
// List, create, edit, delete and manage images.
// ==========================================

// Get all categories for owner dashboard
router.get('/owner/categories',...owner,wrap(async(req,res)=>{
 const r=await query('SELECT * FROM categories ORDER BY sort_order,name');
 res.json({categories:r.rows});
}));

// Create a category
router.post('/owner/categories',...owner,wrap(async(req,res)=>{
 const name=String(req.body.name||'').trim();
 const icon=String(req.body.icon||'package').trim();
 const sortOrder=Number.isInteger(Number(req.body.sortOrder))?Number(req.body.sortOrder):0;

 if(!name||name.length>100){
  return res.status(400).json({error:'Category name is required (maximum 100 characters).'});
 }

 const r=await query(
  'INSERT INTO categories(name,icon,sort_order) VALUES($1,$2,$3) RETURNING *',
  [name,icon,sortOrder]
 );

 res.status(201).json({category:r.rows[0]});
}));

// Edit category details
router.patch('/owner/categories/:id',...owner,wrap(async(req,res)=>{
 const b=req.body;
 const sets=[];
 const vals=[];

 if(b.name!==undefined){
  const name=String(b.name).trim();

  if(!name||name.length>100){
   return res.status(400).json({error:'Category name is required (maximum 100 characters).'});
  }

  vals.push(name);
  sets.push(`name=$${vals.length}`);
 }

 if(b.icon!==undefined){
  vals.push(String(b.icon||'package').trim());
  sets.push(`icon=$${vals.length}`);
 }

 if(b.sortOrder!==undefined){
  const n=Number(b.sortOrder);

  if(!Number.isInteger(n)){
   return res.status(400).json({error:'Sort order must be a whole number.'});
  }

  vals.push(n);
  sets.push(`sort_order=$${vals.length}`);
 }

 if(b.isActive!==undefined){
  vals.push(Boolean(b.isActive));
  sets.push(`is_active=$${vals.length}`);
 }

 if(!sets.length){
  return res.status(400).json({error:'No category fields supplied.'});
 }

 sets.push('updated_at=NOW()');
 vals.push(req.params.id);

 const r=await query(
  `UPDATE categories SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
  vals
 );

 if(!r.rowCount)return res.status(404).json({error:'Category not found.'});

 res.json({category:r.rows[0]});
}));

// Delete category and its stored image
// Products remain; their category reference becomes NULL.
router.delete('/owner/categories/:id',...owner,wrap(async(req,res)=>{
 const r=await query('DELETE FROM categories WHERE id=$1 RETURNING image_key',[req.params.id]);

 if(!r.rowCount)return res.status(404).json({error:'Category not found.'});

 if(r.rows[0].image_key){
  try{
   await remove(r.rows[0].image_key);
  }catch(e){
   console.error('Category image cleanup failed:',e.message);
  }
 }

 res.json({deleted:true});
}));

// Upload or replace category image
// Multipart form field name must be: image
router.post('/owner/categories/:id/image',...owner,storage.single('image'),wrap(async(req,res)=>{
 if(!req.file){
  return res.status(400).json({error:'Choose an image (JPG, PNG, WEBP or GIF), max 5 MB.'});
 }

 const old=await query('SELECT image_key FROM categories WHERE id=$1',[req.params.id]);

 if(!old.rowCount){
  return res.status(404).json({error:'Category not found.'});
 }

 const key=`categories/${Date.now()}-${require('crypto').randomUUID()}`;
 const url=await upload(key,req.file.buffer,req.file.mimetype);

 const r=await query(
  'UPDATE categories SET image_key=$1,image_url=$2,updated_at=NOW() WHERE id=$3 RETURNING *',
  [key,url,req.params.id]
 );

 // Remove previous image from R2 after successful replacement.
 if(old.rows[0].image_key){
  try{
   await remove(old.rows[0].image_key);
  }catch(e){
   console.error('Old category image cleanup failed:',e.message);
  }
 }

 res.status(201).json({category:r.rows[0]});
}));

// Remove category image and delete old R2 object
router.delete('/owner/categories/:id/image',...owner,wrap(async(req,res)=>{
 const old=await query('SELECT image_key FROM categories WHERE id=$1',[req.params.id]);

 if(!old.rowCount){
  return res.status(404).json({error:'Category not found.'});
 }

 await query(
  'UPDATE categories SET image_key=NULL,image_url=NULL,updated_at=NOW() WHERE id=$1',
  [req.params.id]
 );

 if(old.rows[0].image_key){
  try{
   await remove(old.rows[0].image_key);
  }catch(e){
   console.error('Category image cleanup failed:',e.message);
  }
 }

 res.json({imageRemoved:true});
}));

// ==========================================
// OWNER NOTICES AND SHOP SETTINGS
// ==========================================

router.post('/owner/notices',...owner,wrap(async(req,res)=>{
 const r=await query(
  'INSERT INTO notices(title,body,is_published) VALUES($1,$2,$3) RETURNING *',
  [req.body.title,req.body.body,!!req.body.isPublished]
 );

 if(req.body.isPublished){
  const users=await query("SELECT id FROM users WHERE role='customer' AND is_active");

  for(const u of users.rows){
   await notify(u.id,req.body.title,req.body.body,'notice',r.rows[0].id);
  }
 }

 res.status(201).json({notice:r.rows[0]});
}));

// Update shop setting
router.put('/owner/settings/:key',...owner,wrap(async(req,res)=>{
 const r=await query(
  'INSERT INTO shop_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW() RETURNING *',
  [req.params.key,JSON.stringify(req.body.value)]
 );

 res.json({setting:r.rows[0]});
}));

// General image upload to Cloudflare R2
router.post('/owner/upload',...owner,storage.single('image'),wrap(async(req,res)=>{
 if(!req.file){
  return res.status(400).json({error:'Choose an image (JPG, PNG, WEBP or GIF), max 5 MB.'});
 }

 const key=`products/${Date.now()}-${require('crypto').randomUUID()}`;
 const url=await upload(key,req.file.buffer,req.file.mimetype);

 res.status(201).json({key,url});
}));

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports=router;
