import { redirect } from 'next/navigation';

export default function Page() {
  // Redirect to the default space/section
  redirect('/catalog/sources');
}
