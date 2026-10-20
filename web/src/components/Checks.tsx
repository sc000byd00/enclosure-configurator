import type { Check } from "@/lib/api";
import styles from "./Checks.module.css";

const TAG = { true: "PASS", false: "FAIL", null: "INFO" } as const;

export default function Checks({ checks, notes }: { checks: Check[]; notes: string[] }) {
  return (
    <ul className={styles.list} aria-label="design checks">
      {notes.map((n) => (
        <li key={n} className={styles.note}><span className={styles.tag}>NOTE</span>{n}</li>
      ))}
      {checks.map((c) => {
        const tag = TAG[String(c.ok) as "true" | "false" | "null"];
        return (
          <li key={c.id} className={styles[tag.toLowerCase()]}>
            <span className={styles.tag}>{tag}</span>
            {c.message}
          </li>
        );
      })}
    </ul>
  );
}
