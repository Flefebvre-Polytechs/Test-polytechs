import styles from './brand-loader.module.css';

/** Follows the caller's real pending state; never adds an artificial delay. */
export function BrandLoader({message = 'Chargement de votre espace…'}: {message?: string}) {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.content}>
        <img
          className={styles.logo}
          src="/polytechs-connect-loader.svg"
          width="320"
          height="230"
          alt="Polytechs Connect"
          fetchPriority="high"
          decoding="async"
        />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}
