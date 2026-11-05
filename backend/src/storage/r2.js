const {S3Client,PutObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
let client;
function getClient(){
 if(!process.env.R2_ACCOUNT_ID||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY||!process.env.R2_BUCKET_NAME||!process.env.R2_PUBLIC_BASE_URL)throw new Error('Cloudflare R2 is not configured.');
 if(!client)client=new S3Client({region:'auto',endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
 return client;
}
async function upload(key,body,contentType){await getClient().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key,Body:body,ContentType:contentType}));return `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/,'')}/${key}`;}
async function remove(key){return getClient().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key}));}
module.exports={upload,remove};
