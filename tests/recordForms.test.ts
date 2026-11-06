import { recordDetailFixture } from './support/dataList';
import { projectPreview } from 'src/preview/project';
import {
    saveRecord,
    sessionDocument,
    shownRecord,
    type RecordSession
} from 'src/preview/recordForms';

function fixture() {
    const { document } = recordDetailFixture();
    document.dataFields.age = {
        id: 'age',
        name: 'Age',
        entityId: 'customers',
        type: 'number',
        required: true
    };
    document.dataFields.active = {
        id: 'active',
        name: 'Active',
        entityId: 'customers',
        type: 'boolean',
        required: true
    };
    document.dataRecords.ada.values = { name: 'Ada', age: 36, active: true };
    const session: RecordSession = { documentId: document.id, records: {} };

    return { document, session };
}

it('validates all required fields atomically, allowing false and zero', () => {
    const { document, session } = fixture();
    const bad = saveRecord(document, session, 'ada', { name: ' ', age: 'no', active: '' });
    expect(Object.keys(bad.problems).sort()).toEqual(['active', 'age', 'name']);
    expect(bad.session).toBe(session);
    for (const value of ['Infinity', 'NaN', '-Infinity']) {
        expect(
            saveRecord(document, session, 'ada', { name: 'Ada', age: value, active: 'false' })
                .problems.age
        ).toBe('Age must be number.');
    }
    const good = saveRecord(document, session, 'ada', {
        name: 'Countess',
        age: '0',
        active: 'false'
    });
    expect(good.problems).toEqual({});
    expect(sessionDocument(document, good.session).dataRecords.ada.values).toEqual({
        name: 'Countess',
        age: 0,
        active: false
    });
    expect(document.dataRecords.ada.values).toEqual({ name: 'Ada', age: 36, active: true });
});

it('keeps saved records local, reflects them in list and detail projections, and resets from authored records', () => {
    const { document, session } = fixture();
    const before = JSON.stringify(document);
    const saved = saveRecord(document, session, 'ada', {
        name: 'Updated',
        age: '42',
        active: 'true'
    }).session;
    const projection = projectPreview(sessionDocument(document, saved), {});
    expect(JSON.stringify(projection.screens.find((screen) => screen.id === 'home'))).toContain(
        'Updated'
    );
    expect(JSON.stringify(projection.screens.find((screen) => screen.id === 'details'))).toContain(
        'Updated'
    );
    expect(sessionDocument(document, session).dataRecords.ada.values.name).toBe('Ada');
    expect(
        sessionDocument({ ...document, id: 'another-document' }, saved).dataRecords.ada.values.name
    ).toBe('Ada');
    expect(JSON.stringify(document)).toBe(before);
});

it('drops deleted and incompatible session fields and records, but keeps compatible renames', () => {
    const { document, session } = fixture();
    const saved = saveRecord(document, session, 'ada', {
        name: 'Updated',
        age: '42',
        active: 'false'
    }).session;
    document.dataFields.name.name = 'Full name';
    expect(sessionDocument(document, saved).dataRecords.ada.values.name).toBe('Updated');
    document.dataFields.age.type = 'text';
    document.dataRecords.ada.values.age = 'authored';
    expect(sessionDocument(document, saved).dataRecords.ada.values.age).toBe('authored');
    delete document.dataFields.active;
    delete document.dataRecords.ada.values.active;
    expect(sessionDocument(document, saved).dataRecords.ada.values).not.toHaveProperty('active');
    delete document.dataRecords.ada;
    expect(sessionDocument(document, saved).dataRecords).not.toHaveProperty('ada');
    expect(saveRecord(document, saved, 'ada', {}).problems.record).toBeDefined();
});

it('accepts optional unset numeric and boolean fields without coercing invalid booleans', () => {
    const { document, session } = fixture();
    document.dataFields.age.required = false;
    document.dataFields.active.required = false;
    const result = saveRecord(document, session, 'ada', { name: 'Ada', age: '', active: '' });
    expect(result.problems).toEqual({});
    expect(result.session.records.ada.values).toEqual({ name: 'Ada', age: null, active: null });
    expect(
        saveRecord(document, session, 'ada', { name: 'Ada', age: '', active: 'yes' }).problems
            .active
    ).toBe('Active must be boolean.');
});

it('accepts runtime record context only when the current screen contains that entity and record', () => {
    const { document } = fixture();
    const drawing = projectPreview(document, {});
    expect(shownRecord(drawing, 'details', { id: 'ada', entityId: 'customers' })).toEqual({
        id: 'ada',
        entityId: 'customers'
    });
    for (const value of [
        null,
        'ada',
        { id: 'missing', entityId: 'customers' },
        { id: 'ada', entityId: 'wrong' }
    ]) {
        expect(shownRecord(drawing, 'details', value)).toBeUndefined();
    }
    expect(shownRecord(drawing, 'home', { id: 'ada', entityId: 'customers' })).toBeUndefined();
});
