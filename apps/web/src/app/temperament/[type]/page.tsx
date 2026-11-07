import type { Metadata } from "next";
import { ShortTestTypePage, shortTestTypeMetadata, shortTestTypeParams } from "@/components/short-tests/ShortTestTypePage";

export const dynamicParams = false;

export function generateStaticParams() {
  return shortTestTypeParams("temperament");
}

type Props = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return shortTestTypeMetadata("temperament", (await params).type);
}

export default async function TemperamentTypePage({ params }: Props) {
  return <ShortTestTypePage slug="temperament" typeSlug={(await params).type} />;
}
