import { notFound } from 'next/navigation';
import { appIconResponse } from '@/lib/app-icon';

const SIZES: Record<string, number> = {
  'icon-192.png': 192,
  'icon-512.png': 512,
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = SIZES[file];
  if (!size) notFound();
  return appIconResponse(size);
}
