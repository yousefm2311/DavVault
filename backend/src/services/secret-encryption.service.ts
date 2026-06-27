import crypto from 'crypto';

const PREFIX = 'enc:v1:';

const getConfiguredSecret = (): string | undefined =>
  process.env.AI_AGENT_ENCRYPTION_KEY || process.env.JWT_SECRET;

export const isSecretEncryptionConfigured = (): boolean => {
  const secret = getConfiguredSecret();
  return Boolean(secret && secret.length >= 32);
};

const getEncryptionKey = (): Buffer => {
  const secret = getConfiguredSecret();
  if (!secret || secret.length < 32) {
    throw new Error(
      'AI_AGENT_ENCRYPTION_KEY (or JWT_SECRET fallback) must contain at least 32 characters.'
    );
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest();
};

export const isEncryptedSecret = (value?: string): boolean =>
  Boolean(value?.startsWith(PREFIX));

export const encryptSecret = (value: string): string => {
  if (!value) return '';
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};

export const decryptSecret = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!isEncryptedSecret(value)) return value;

  const [, , ivPart, authTagPart, encryptedPart] = value.split(':');
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Invalid encrypted secret payload.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
