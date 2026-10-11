import { downloadCSV, type Exporter, type RaRecord } from 'ra-core';
import jsonExport from 'jsonexport/dist';
/** Local exports omit Runtime bases and neutralize spreadsheet formula cells. */
export function safeExportValue(value: unknown): unknown {
  if (typeof value === 'string') return /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  if (Array.isArray(value)) return value.map(safeExportValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='_house').map(([key,item])=>[key,safeExportValue(item)]));
  return value;
}
export const safeExporter: Exporter = (records: RaRecord[], _related, _provider, resource) => new Promise<void>((resolve,reject)=>{
 jsonExport(safeExportValue(records) as object[], {}, (error:Error|null,csv:string)=>{if(error){reject(error);return;}downloadCSV(csv,resource??'crm');resolve();});
});
