declare module 'troika-three-text' {
  export type TextBuilderConfig = {
    unicodeFontsURL?: string | null;
    defaultFontURL?: string | null;
    useWorker?: boolean;
  };

  export function configureTextBuilder(config: TextBuilderConfig): void;
}
