import { LEASE_PRICES, type Lease } from "@/lib/payments";

const features = [
  ["MP3 file", "Included", "Included", "Included", "Included"],
  ["WAV file", "—", "Included", "Included", "Included"],
  ["Stems / trackouts", "—", "—", "Included", "Included"],
  ["Audio streams", "20,000", "50,000", "Unlimited", "Unlimited"],
  ["Music videos", "1", "1", "Unlimited", "Unlimited"],
  ["Video streams / views", "20,000", "50,000", "Unlimited", "Unlimited"],
  ["Paid downloads / sales", "1,000", "5,000", "Unlimited", "Unlimited"],
  ["Free downloads", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  ["Non-profit performances", "Allowed", "Allowed", "Allowed", "Allowed"],
  ["Paid performances", "—", "Allowed", "Allowed", "Allowed"],
  ["Radio", "—", "—", "Allowed", "Allowed"],
  ["Monetization", "Allowed", "Allowed", "Allowed", "Allowed"],
  ["Commercial release", "Allowed", "Allowed", "Allowed", "Allowed"],
  ["Content ID", "Not allowed", "Not allowed", "Not allowed", "Negotiated"],
  ["New licenses can still be sold", "Yes", "Yes", "Yes", "No"],
  ["Term", "Perpetual", "Perpetual", "Perpetual", "Perpetual*"],
];

export function LeaseDetails({ lease }: { lease: Lease }) {
  const column = lease === "mp3" ? 1 : 2;
  return <section className="lease-details" aria-label={`${lease.toUpperCase()} license details`}>
    <h3>{lease.toUpperCase()} license includes</h3>
    <p className="lease-files">{lease === "mp3" ? "MP3 file" : "MP3 + WAV files"} · Non-exclusive · Perpetual</p>
    <dl className="lease-limits">
      {features.slice(3,7).map(row => <div key={row[0]}><dt>{row[0]}</dt><dd>{row[column]}</dd></div>)}
    </dl>
    <p className="lease-usage">Commercial release, monetization, unlimited free downloads and non-profit performances are allowed. {lease === "wav" ? "Paid performances are also allowed." : "Paid performances are not included."} Stems, radio and Content ID are not included. The beat remains available for other artists to license.</p>
    <details className="lease-comparison">
      <summary>Compare all licenses</summary>
      <div className="lease-comparison-scroll" tabIndex={0} role="region" aria-label="License comparison">
        <table>
          <caption className="sr-only">Beat license rights and limits</caption>
          <thead><tr><th scope="col">License</th>{["MP3", "WAV", "Unlimited", "Exclusive"].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Price</th><td>${(LEASE_PRICES.mp3 / 100).toFixed(2)} USD</td><td>${(LEASE_PRICES.wav / 100).toFixed(2)} USD</td><td>Contact</td><td>Contact</td></tr>
            {features.map(([label,...values]) => <tr key={label}><th scope="row">{label}</th>{values.map((value,index) => <td key={index}>{value === "—" ? "Not included" : value}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <p className="lease-usage">Unlimited and Exclusive: DM <a href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer">@yearofziova ↗</a> for availability and pricing. *Exclusive terms and Content ID permissions are agreed directly before purchase.</p>
    </details>
  </section>;
}
