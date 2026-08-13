import { DOCUMENT_BOX_SEEDS, DOCUMENT_SEEDS } from '../seeds/document.seed';
import type { DocumentBox, DocumentItem, RuleVersion } from '@/domain/document/schema';

class DocumentRepository {
  private boxes: DocumentBox[] = [...DOCUMENT_BOX_SEEDS];
  private documents: DocumentItem[] = [...DOCUMENT_SEEDS];

  public getBoxes(): DocumentBox[] {
    return this.boxes;
  }

  public createBox(name: string, desc?: string): DocumentBox {
    const newBox: DocumentBox = {
      id: `box_${Date.now()}`,
      name,
      desc
    };
    this.boxes.push(newBox);
    return newBox;
  }

  public updateBox(id: string, name: string, desc?: string): DocumentBox | null {
    const box = this.boxes.find((b) => b.id === id);
    if (!box) return null;
    box.name = name;
    box.desc = desc;
    return box;
  }

  public getDocuments(): DocumentItem[] {
    return this.documents;
  }

  public createDocument(data: Omit<DocumentItem, 'id' | 'date' | 'versions'>): DocumentItem {
    const today = new Date().toISOString().split('T')[0];
    const newDoc: DocumentItem = {
      id: Date.now(),
      boxId: data.boxId,
      name: data.name,
      desc: data.desc,
      attachments: data.attachments,
      dept: data.dept,
      author: data.author,
      date: today,
      version: data.version,
      isRule: data.isRule,
      versions: data.isRule && data.version ? [
        {
          version: data.version,
          effectiveDate: today,
          revisedDate: today,
          reason: '최초 등록',
          attachments: data.attachments,
          author: data.author,
          date: today
        }
      ] : []
    };
    this.documents.push(newDoc);
    return newDoc;
  }

  public updateDocument(id: number, data: Partial<Omit<DocumentItem, 'id' | 'versions'>>): DocumentItem | null {
    const docIndex = this.documents.findIndex((d) => d.id === id);
    if (docIndex === -1) return null;

    const existing = this.documents[docIndex];
    const updated: DocumentItem = {
      ...existing,
      ...data,
      // 규정이 아닐 때에만 버전을 변경할 수 있도록 함 (규정은 createRuleVersion을 통해서만 버전을 업데이트해야 함)
      version: existing.isRule ? existing.version : (data.version ?? existing.version)
    };

    this.documents[docIndex] = updated;
    return updated;
  }

  public createRuleVersion(docId: number, versionData: Omit<RuleVersion, 'date'>): DocumentItem | null {
    const docIndex = this.documents.findIndex((d) => d.id === docId);
    if (docIndex === -1) return null;

    const doc = this.documents[docIndex];
    if (!doc.isRule) return null;

    const today = new Date().toISOString().split('T')[0];
    const newVer: RuleVersion = {
      ...versionData,
      date: today
    };

    // 과거 이력 맨 앞에 새 버전을 끼워 넣는다.
    const updatedVersions = [newVer, ...doc.versions];

    // 최신 정보 동기화
    const updatedDoc: DocumentItem = {
      ...doc,
      version: versionData.version,
      attachments: versionData.attachments,
      date: today,
      versions: updatedVersions
    };

    this.documents[docIndex] = updatedDoc;
    return updatedDoc;
  }

  public deleteDocument(id: number): boolean {
    const initialLen = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== id);
    return this.documents.length < initialLen;
  }
}

export const documentRepo = new DocumentRepository();
