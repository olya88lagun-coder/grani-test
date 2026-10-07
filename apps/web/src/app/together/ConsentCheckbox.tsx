"use client";

// Явное согласие на обработку ответов в «Вдвоём»: отдельная отметка до создания пространства и до запроса по ссылке.
// Тексты документов — на страницах согласия и политики, здесь только отметка и подсказка
export function ConsentCheckbox({ id, checked, onChange }: { id: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="stack">
      <label className="choice" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>
          Мне есть 18 лет. Я даю согласие на обработку моих ответов и данных пары в «Вдвоём» на условиях{" "}
          <a href="/consent" target="_blank" rel="noopener">согласия</a> и <a href="/privacy" target="_blank" rel="noopener">политики</a>.
        </span>
      </label>
      <p className="muted">Не пишите в ответах о здоровье, интимной жизни, политических и религиозных взглядах: такие сведения сервису не нужны.</p>
    </div>
  );
}
