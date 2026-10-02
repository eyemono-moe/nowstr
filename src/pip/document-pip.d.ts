// Document Picture-in-Picture API (Chromium 116+)。TypeScript の lib.dom にはまだ含まれていない。
// https://wicg.github.io/document-picture-in-picture/

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
  preferInitialWindowPlacement?: boolean;
}

interface DocumentPictureInPictureEvent extends Event {
  readonly window: Window;
}

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  readonly window: Window | null;
  onenter: ((this: DocumentPictureInPicture, ev: DocumentPictureInPictureEvent) => unknown) | null;
}

interface Window {
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
