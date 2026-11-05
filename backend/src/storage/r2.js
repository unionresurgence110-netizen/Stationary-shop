
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');

let client;

function getConfig() {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `${key} is missing from environment variables.`
      );
    }
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
  };
}

function getClient() {
  const config = getConfig();

  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  return client;
}

function validateKey(key) {
  if (
    typeof key !== 'string' ||
    !key.trim() ||
    key.startsWith('/') ||
    key.split('/').some(
      (part) => part === '..' || part === '.'
    )
  ) {
    throw new Error('Invalid storage file key.');
  }
}

async function upload(key, body, contentType) {
  validateKey(key);

  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new Error('A valid image buffer is required.');
  }

  if (
    typeof contentType !== 'string' ||
    !contentType.startsWith('image/')
  ) {
    throw new Error('A valid image content type is required.');
  }

  const config = getConfig();

  await getClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );

  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${config.publicUrl}/${encodedKey}`;
}

async function remove(key) {
  validateKey(key);

  const config = getConfig();

  return getClient().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key
    })
  );
}

module.exports = {
  upload,
  remove
};
