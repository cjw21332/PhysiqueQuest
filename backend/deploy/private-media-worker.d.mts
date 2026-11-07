declare const worker: {
  fetch(request: Request, env: {
    CDN_SIGNING_KEY: string;
    CORS_ALLOWED_ORIGINS?: string;
    MEDIA: { get(key: string): Promise<{ body: BodyInit; httpMetadata?: { contentType?: string } } | null> };
  }): Promise<Response>;
};
export default worker;
