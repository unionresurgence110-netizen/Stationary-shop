const jwt=require('jsonwebtoken');
const {query}=require('./db');
async function auth(req,res,next){
 const h=req.headers.authorization||'';
 if(!h.startsWith('Bearer '))return res.status(401).json({error:'Please sign in.'});
 try{
  const payload=jwt.verify(h.slice(7),process.env.JWT_SECRET);
  const r=await query('SELECT id,role,is_active FROM users WHERE id=$1',[payload.id]);
  if(!r.rowCount||!r.rows[0].is_active)return res.status(401).json({error:'Account unavailable. Please sign in again.'});
  req.user={id:r.rows[0].id,role:r.rows[0].role};next();
 }catch(e){if(e.name==='JsonWebTokenError'||e.name==='TokenExpiredError')return res.status(401).json({error:'Session expired. Please sign in again.'});next(e);}
}
function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Owner access required.'});next();}
module.exports={auth,admin};
