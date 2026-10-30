import { logout } from '@/server/mutations/logout';

export const POST = async () => {
  await logout();
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/sign-in',
    },
  });
};
