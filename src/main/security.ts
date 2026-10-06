export const APP_URL = 'aster://app/index.html';
export function trustedSender(senderId: number, expectedId: number, frameUrl: string, isMainFrame: boolean): boolean {
  return senderId === expectedId && isMainFrame && frameUrl === APP_URL;
}
