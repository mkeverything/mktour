import en from '@/messages/en.json';

type Messages = typeof en;

declare global {
  export type IntlMessages = Messages;
}
