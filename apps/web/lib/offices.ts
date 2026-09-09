// apps/web/lib/offices.ts
//
// `lines` is what renders in the footer/contact page. The structured
// fields (streetAddress, addressLocality, etc.) feed the sitewide
// PostalAddress schema in layout.tsx — kept separate from `lines`
// rather than parsed out of it, since free-text address formatting
// doesn't reliably split into schema.org's fields.
export const OFFICES = [
  {
    region: "UK, US and Europe Office",
    lines: ["52 Millbrook Road, Edmonton", "London, N9 7HX"],
    tel: "+442035904976",
    phone: "+44 203 590 4976",
    email: "support@runserv.org",
    streetAddress: "52 Millbrook Road, Edmonton",
    addressLocality: "London",
    postalCode: "N9 7HX",
    addressCountry: "GB",
  },
  {
    region: "Nigeria and West Africa Office",
    lines: ["Plot 35, Central Business District, OPIC", "Agbara Industrial Estate, Lagos-Ogun Corridor", "Nigeria"],
    tel: "+2348065104250",
    phone: "+234 806 5104250",
    email: "support@runserv.org",
    streetAddress: "Plot 35, Central Business District, OPIC, Agbara Industrial Estate, Lagos-Ogun Corridor",
    addressLocality: "Lagos",
    postalCode: "",
    addressCountry: "NG",
  },
];

