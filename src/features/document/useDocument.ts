import { useState, useCallback } from 'react';
import { documentRepo } from '@/data/document/document.repo';
import type { DocumentBox, DocumentItem, RuleVersion } from '@/domain/document/schema';

export function useDocument() {
  const [boxes, setBoxes] = useState<DocumentBox[]>(() => documentRepo.getBoxes());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => documentRepo.getDocuments());

  const refresh = useCallback(() => {
    setBoxes([...documentRepo.getBoxes()]);
    setDocuments([...documentRepo.getDocuments()]);
  }, []);

  const createBox = useCallback((name: string, desc?: string) => {
    documentRepo.createBox(name, desc);
    refresh();
  }, [refresh]);

  const updateBox = useCallback((id: string, name: string, desc?: string) => {
    documentRepo.updateBox(id, name, desc);
    refresh();
  }, [refresh]);

  const createDocument = useCallback((data: Omit<DocumentItem, 'id' | 'date' | 'versions'>) => {
    const newDoc = documentRepo.createDocument(data);
    refresh();
    return newDoc;
  }, [refresh]);

  const updateDocument = useCallback((id: number, data: Partial<Omit<DocumentItem, 'id' | 'versions'>>) => {
    const updated = documentRepo.updateDocument(id, data);
    refresh();
    return updated;
  }, [refresh]);

  const createRuleVersion = useCallback((docId: number, versionData: Omit<RuleVersion, 'date'>) => {
    const updated = documentRepo.createRuleVersion(docId, versionData);
    refresh();
    return updated;
  }, [refresh]);

  const deleteDocument = useCallback((id: number) => {
    const success = documentRepo.deleteDocument(id);
    refresh();
    return success;
  }, [refresh]);

  return {
    boxes,
    documents,
    createBox,
    updateBox,
    createDocument,
    updateDocument,
    createRuleVersion,
    deleteDocument
  };
}
