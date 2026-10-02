import { beats } from "@/data/beats";

export function BeatVault() {
  return (
    <section className="beat-vault" aria-labelledby="beat-vault-title">
      <h1 id="beat-vault-title">Beat Vault</h1>
      <table className="vault-playlist">
        <thead>
          <tr><th scope="col">Name</th><th scope="col">BPM</th></tr>
        </thead>
        <tbody>
          {beats.map((beat) => (
            <tr key={beat.id}>
              <td>{beat.title}</td>
              <td>{beat.bpm}</td>
            </tr>
          ))}
          {beats.length === 0 && (
            <tr><td colSpan={2} className="playlist-empty">Beats coming soon.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
