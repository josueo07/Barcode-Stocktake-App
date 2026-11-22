/**
 * The camera's EAN-13 reader also reads UPC-A labels, adding a leading 0
 * ("8 01108 11003 1" comes out as "0801108110031"). Return the 12 digits printed on the label
 * so the code on screen matches the box. The server matches either form.
 */
export function printedBarcode(code: string): string {
  return /^0\d{12}$/.test(code) ? code.slice(1) : code;
}
