import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedNotice({ model }: { model: ContractDetailPageModel }) {
  const { contract, creationNotice } = model;

  return (
    <>
      {creationNotice ? (
        <div className={creationNotice.tone === "success" ? "ui-alert-success" : "ui-alert-warning"}>
          <p className="font-semibold">{creationNotice.title}</p>
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
            {creationNotice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
            <D.Link href="#extracted-fields" className="ui-link">
              Open contract details
            </D.Link>
            <D.Link href={`${contract.id ? `/contracts/${contract.id}?tab=overview#source-documents` : "#source-documents"}`} className="ui-link">
              Check source documents
            </D.Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
