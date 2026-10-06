import { LEASE_PRICES, type Lease } from "@/lib/payments";

const features = [
  ["Files", "MP3 (320 kbps)", "MP3 (320 kbps) + WAV", "MP3 + WAV", "MP3 + WAV"],
  ["Stems / trackouts", "—", "—", "Included", "Included"],
  ["Streams (all platforms combined)", "10,000", "25,000", "Unlimited", "Unlimited"],
  ["Music videos (YouTube)", "1", "1", "Unlimited", "Unlimited"],
  ["Paid downloads / sales", "1,000", "5,000", "Unlimited", "Unlimited"],
  ["Free downloads / distribution copies", "2,500", "5,000", "Unlimited", "Unlimited"],
  ["Live performances", "Non-profit only", "Non-profit only", "Allowed", "Allowed"],
  ["Radio / broadcast", "No", "1 station", "Allowed", "Allowed"],
  ["Monetization", "Allowed", "Allowed", "Allowed", "Allowed"],
  ["Commercial release", "Allowed", "Allowed", "Allowed", "Allowed"],
  ["Content ID", "Not allowed", "Not allowed", "Not allowed", "Negotiated"],
  ["Beat stays for sale", "Yes", "Yes", "Yes", "No"],
  ["Credit required", "Prod. by ziova", "Prod. by ziova", "Agreed directly", "Agreed directly"],
  ["Term", "Perpetual", "Perpetual", "Perpetual", "Perpetual*"],
];

export function LeaseDetails({ lease }: { lease: Lease }) {
  const column = lease === "mp3" ? 1 : 2;
  return <section className="lease-details" aria-label={`${lease.toUpperCase()} license details`}>
    <h3>{lease.toUpperCase()} license includes</h3>
    <p className="lease-files">{lease === "mp3" ? "MP3 (320 kbps)" : "MP3 (320 kbps) + WAV"} · Non-exclusive · Perpetual</p>
    <dl className="lease-limits">
      {features.filter(row => ["Streams (all platforms combined)", "Music videos (YouTube)", "Free downloads / distribution copies", "Radio / broadcast"].includes(row[0])).map(row => <div key={row[0]}><dt>{row[0]}</dt><dd>{row[column]}</dd></div>)}
    </dl>
    <p className="lease-usage">Commercial release and monetization are allowed within the license limits. Live performances must be non-profit. {lease === "wav" ? "Radio / broadcast is permitted on one station." : "Radio / broadcast is not included."} Stems and Content ID are not included. Credit is required: “Prod. by ziova”. The beat remains available for other artists to license.</p>
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
