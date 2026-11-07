import type { Metadata } from "next";
import { ShortTestTypePage, shortTestTypeMetadata, shortTestTypeParams } from "@/components/short-tests/ShortTestTypePage";

export const dynamicParams = false;

export function generateStaticParams() {
  return shortTestTypeParams("attachment");
}

type Props = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return shortTestTypeMetadata("attachment", (await params).type);
}

export default async function AttachmentTypePage({ params }: Props) {
  return <ShortTestTypePage slug="attachment" typeSlug={(await params).type} palette="pair" />;
}
