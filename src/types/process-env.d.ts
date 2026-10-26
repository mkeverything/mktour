export declare global {
  export namespace NodeJS {
    export interface ProcessEnv {
      [key: string]: string | undefined;
      PORT: string;
      DATABASE_URL: string;
      TEST_DATABASE_URL: string;
      TEST_DATABASE_AUTH_TOKEN: string;
      DATABASE_AUTH_TOKEN: string;
      UPSTASH_REDIS_REST_TOKEN: string;
      UPSTASH_REDIS_REST_URL: string;
      NEXT_PUBLIC_BASE_URL: string;
      NEXT_PUBLIC_SOCKET_URL: string;
      CRON_SECRET: string;
      NEXT_PUBLIC_AXIOM_INGEST_ENDPOINT: string;
      LICHESS_CLIENT_ID: string;
      REDIS_URL: string;
      // add more environment variables and their types here
    }
  }
}
