// Invoke from a trusted scheduler (e.g. once every 5 minutes) using a protected job endpoint
// or run this module from a scheduled worker. Expired reserved stock is returned atomically.
const {pool}=require('../db');
async function expireReservations(){
 const c=await pool.connect();try{
  await c.query('BEGIN');
  const rows=await c.query("SELECT * FROM reservations WHERE status='Reserved' AND expires_at<=NOW() FOR UPDATE SKIP LOCKED");
  for(const r of rows.rows){
   await c.query('UPDATE products SET stock_quantity=stock_quantity+$1 WHERE id=$2',[r.quantity,r.product_id]);
   await c.query("UPDATE reservations SET status='Expired',updated_at=NOW() WHERE id=$1",[r.id]);
   await c.query("INSERT INTO notifications(user_id,title,body,related_type,related_id) VALUES($1,'Reservation expired','Your 24-hour pickup reservation expired.','reservation',$2)",[r.user_id,r.id]);
  }
  await c.query('COMMIT');return rows.rowCount;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
module.exports={expireReservations};
