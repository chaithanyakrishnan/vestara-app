/**
 * Employer lookup table backing the EIN autocomplete, ported verbatim from the
 * prototype's `CO_DB`. Client-side only and deliberately so: `employerEin` is
 * validated by shape (XX-XXXXXXX) in @vestara/shared, not against this list, so
 * a company absent from here can still be typed in by hand. Swapping this for a
 * real EIN lookup service should only need to change `searchCompanies`.
 */
export interface Company {
  ein: string;
  name: string;
  addr: string;
  city: string;
  state: string;
  zip: string;
}

export const CO_DB: Company[] = [
  { ein: "45-0431167", name: "4 Bears Casino & Lodge", addr: "202 Frontage Rd", city: "New Town", state: "ND", zip: "58763" },
  { ein: "91-1144442", name: "Microsoft Corporation", addr: "One Microsoft Way", city: "Redmond", state: "WA", zip: "98052" },
  { ein: "94-1517784", name: "Apple Inc.", addr: "One Apple Park Way", city: "Cupertino", state: "CA", zip: "95014" },
  { ein: "91-1646860", name: "Amazon.com Inc.", addr: "410 Terry Ave N", city: "Seattle", state: "WA", zip: "98109" },
  { ein: "77-0493581", name: "Alphabet Inc. (Google)", addr: "1600 Amphitheatre Pkwy", city: "Mountain View", state: "CA", zip: "94043" },
  { ein: "20-1624254", name: "Meta Platforms Inc.", addr: "1 Hacker Way", city: "Menlo Park", state: "CA", zip: "94025" },
  { ein: "13-4461988", name: "JPMorgan Chase & Co.", addr: "383 Madison Ave", city: "New York", state: "NY", zip: "10179" },
  { ein: "94-1692701", name: "Wells Fargo & Company", addr: "420 Montgomery St", city: "San Francisco", state: "CA", zip: "94104" },
  { ein: "59-0936469", name: "FIS Global", addr: "347 Riverside Ave", city: "Jacksonville", state: "FL", zip: "32202" },
  { ein: "39-1720717", name: "Fiserv Inc.", addr: "255 Fiserv Dr", city: "Brookfield", state: "WI", zip: "53045" },
  { ein: "52-0684746", name: "T. Rowe Price Group", addr: "100 E Pratt St", city: "Baltimore", state: "MD", zip: "21202" },
  { ein: "23-1945930", name: "Vanguard Group", addr: "100 Vanguard Blvd", city: "Malvern", state: "PA", zip: "19355" },
  { ein: "04-1590650", name: "Fidelity Investments", addr: "245 Summer St", city: "Boston", state: "MA", zip: "02210" },
  { ein: "75-1261498", name: "AT&T Inc.", addr: "208 S Akard St", city: "Dallas", state: "TX", zip: "75202" },
  { ein: "47-4956954", name: "Altimetrik Corp.", addr: "3000 Town Center Blvd", city: "Southfield", state: "MI", zip: "48075" },
  { ein: "13-5501798", name: "Citigroup Inc.", addr: "388 Greenwich St", city: "New York", state: "NY", zip: "10013" },
  { ein: "01-0596566", name: "Target Corporation", addr: "1000 Nicollet Mall", city: "Minneapolis", state: "MN", zip: "55403" },
  { ein: "71-0415188", name: "Walmart Inc.", addr: "702 SW 8th St", city: "Bentonville", state: "AR", zip: "72716" },
];

export const formatCompanyAddress = (c: Company) => `${c.addr}, ${c.city}, ${c.state} ${c.zip}`;

/** Matches on digits of the EIN or on any part of the name. */
export function searchCompanies(query: string, limit = 6): Company[] {
  const q = query.replace(/-/g, "").toLowerCase().trim();
  if (q.length < 2) return [];
  return CO_DB.filter(
    (c) => c.ein.replace(/-/g, "").includes(q) || c.name.toLowerCase().includes(q),
  ).slice(0, limit);
}
