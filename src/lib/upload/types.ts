export type ImageUploadProvider = 'disabled' | 'catbox' | 'litterbox' | 's3' | 'microbin' | 'zipline';

export type LitterboxTime = '1h' | '12h' | '24h' | '72h';

export interface ImageUploadConfig {
  provider: ImageUploadProvider;
  catboxUserhash?: string;
  litterboxTime?: LitterboxTime;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
  s3PublicUrlPrefix?: string;
  microbinUrl?: string;
  microbinPassword?: string;
  ziplineUrl?: string;
  ziplineToken?: string;
}

export interface UrlAuthRule {
  id: string;
  urlPrefix: string;
  headerName: string;
  headerValue: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
}
