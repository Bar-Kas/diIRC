export type ImageUploadProvider = 'disabled' | 'litterbox' | 'pomf';

export type LitterboxTime = '1h' | '12h' | '24h' | '72h';

export interface ImageUploadConfig {
  provider: ImageUploadProvider;
  litterboxTime?: LitterboxTime;
  pomfUrl?: string;
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
