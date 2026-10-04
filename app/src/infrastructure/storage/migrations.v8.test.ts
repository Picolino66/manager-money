import { migrateDocument, migrateV7ToV8 } from './migrations';

describe('migração v7 → v8 (ADR-018)', () => {
  it('o excedente pago sobre a fatura vira encargos; nenhum valor muda', () => {
    const v7 = {
      schemaVersion: 7,
      statementPayments: [
        { id: 'a', statementAmount: 100000, paidAmount: 108000 },
        { id: 'b', statementAmount: 50000, paidAmount: 50000 },
      ],
    };

    expect(migrateV7ToV8(v7)).toEqual({
      schemaVersion: 8,
      statementPayments: [
        { id: 'a', statementAmount: 100000, paidAmount: 108000, charges: 8000 },
        { id: 'b', statementAmount: 50000, paidAmount: 50000, charges: 0 },
      ],
    });
    expect(migrateDocument(v7, new Date())).toMatchObject({ schemaVersion: 8 });
    expect(migrateV7ToV8({ schemaVersion: 7 })).toEqual({
      schemaVersion: 8,
      statementPayments: [],
    });
  });
});
