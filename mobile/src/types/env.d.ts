declare const process: {
  env: {
    [key: string]: string | undefined;
    EXPO_PUBLIC_API_URL?: string;
    EXPO_OS?: string;
  };
};

declare module '*.css';
declare module '*.module.css';
