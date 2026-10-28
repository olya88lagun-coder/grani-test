"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackYearEvent } from "@/lib/new-year-analytics";
import { isNewYearBannerActive } from "@/lib/new-year-banner";
import styles from "./NewYearBanner.module.css";

// Seasonal entry to /new-year-2027 on the home page. Rendered on the server so the link is in the HTML, hidden after the end date on the client.
export function NewYearBanner() {
  const [active, setActive] = useState(true);
  useEffect(() => { setActive(isNewYearBannerActive(new Date())); }, []);
  if (!active) return null;
  return <section className={styles.banner} data-band="night" aria-labelledby="new-year-banner-title">
    <div className={styles.copy}>
      <p className={styles.kicker}>Новогодний спецпроект</p>
      <h2 id="new-year-banner-title" className={styles.title}>Мои грани 2027</h2>
      <p className={styles.text}>Шесть коротких вопросов о прошедшем годе и личная карта на 2027: слово года, первый шаг и план «если — то». Бесплатно, без входа.</p>
    </div>
    <Link className={styles.action} href="/new-year-2027" onClick={() => trackYearEvent("new_year_banner")}>Собрать карту <span aria-hidden="true">→</span></Link>
  </section>;
}
