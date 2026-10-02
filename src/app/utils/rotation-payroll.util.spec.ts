import { Employee } from '../models/employee';
import { resolveRotationPayrollEmployee } from './rotation-payroll.util';

describe('resolveRotationPayrollEmployee', () => {
  const record = (uid: string, owner: string, fields: Partial<Employee> = {}): Employee => ({
    uid, tempUser: { uid: owner }, ...fields,
  } as Employee);
  const original = () => record('original', 'home', { status: 'Transféré' });
  const rotation = (fields: Partial<Employee> = {}) => record('rotation', 'upn', {
    isRotation: true, rotationSourceLocationId: 'home',
    rotationSourceEmployeeId: 'original', canonicalEmployeeId: 'original', ...fields,
  });

  it('keeps an ordinary employee unchanged even with a same-name employee elsewhere', () => {
    const employee = record('ordinary', 'home', { firstName: 'Same', lastName: 'Name' });
    const duplicateName = record('other', 'upn', { firstName: 'Same', lastName: 'Name' });
    expect(resolveRotationPayrollEmployee(employee, [employee, duplicateName]).employee).toBe(employee);
  });

  it('keeps a permanent affectation on its own payment record', () => {
    const employee = rotation({ isRotation: false });
    expect(resolveRotationPayrollEmployee(employee, [original(), employee]).employee).toBe(employee);
  });

  it('resolves an explicitly linked source even when it is no longer active', () => {
    const source = original();
    const employee = rotation();
    expect(resolveRotationPayrollEmployee(employee, [source, employee]).employee).toBe(source);
  });

  it('qualifies document IDs by source location', () => {
    const source = original();
    const wrongSite = record('original', 'elsewhere');
    expect(resolveRotationPayrollEmployee(rotation(), [wrongSite, source]).employee).toBe(source);
    expect(resolveRotationPayrollEmployee(rotation(), [wrongSite]).issue).toBe('missing-source');
  });

  it('follows successive rotations back to the original payroll authority', () => {
    const source = original();
    const intermediate = rotation();
    const latest = record('latest', 'third-site', {
      isRotation: true, rotationSourceLocationId: 'upn', rotationSourceEmployeeId: 'rotation',
      canonicalEmployeeId: 'original',
    });
    expect(resolveRotationPayrollEmployee(latest, [latest, intermediate, source]).employee).toBe(source);
  });

  it('rejects a circular rotation chain', () => {
    const first = rotation();
    const second = record('original', 'home', {
      isRotation: true, rotationSourceLocationId: 'upn', rotationSourceEmployeeId: 'rotation',
    });
    expect(resolveRotationPayrollEmployee(first, [first, second])).toEqual({
      employee: null, issue: 'cyclic-source',
    });
  });

  it('never replaces a missing explicit source with a same-name record', () => {
    const employee = rotation({ firstName: 'Same', lastName: 'Name' });
    const other = record('other', 'home', { firstName: 'Same', lastName: 'Name' });
    expect(resolveRotationPayrollEmployee(employee, [employee, other]).issue).toBe('missing-source');
  });

  it('resolves legacy canonical identity within the original location', () => {
    const source = original();
    expect(resolveRotationPayrollEmployee(rotation({ rotationSourceEmployeeId: undefined }),
      [source, record('other', 'elsewhere', { canonicalEmployeeId: 'original' })]).employee).toBe(source);
  });

  it('resolves legacy rotations by a unique normalized name at the source location', () => {
    const source = record('old', 'home', { firstName: 'Mercisse', lastName: 'Tsimba' });
    const employee = rotation({ rotationSourceEmployeeId: undefined, canonicalEmployeeId: undefined,
      firstName: ' mercisse ', lastName: 'TSIMBA' });
    expect(resolveRotationPayrollEmployee(employee,
      [source, record('unrelated', 'elsewhere', { firstName: 'Mercisse', lastName: 'Tsimba' })]).employee).toBe(source);
  });

  it('rejects duplicate names instead of choosing an arbitrary original', () => {
    const employee = rotation({ rotationSourceEmployeeId: undefined, canonicalEmployeeId: undefined,
      firstName: 'Same', lastName: 'Name' });
    const sources = ['one', 'two'].map((uid) => record(uid, 'home', { firstName: 'Same', lastName: 'Name' }));
    expect(resolveRotationPayrollEmployee(employee, sources)).toEqual({ employee: null, issue: 'ambiguous-source' });
  });

  it('resolves a unique payment code before using a duplicate name', () => {
    const employee = rotation({ rotationSourceEmployeeId: undefined, canonicalEmployeeId: undefined,
      paymentCode: 'PAY-1', firstName: 'Same', lastName: 'Name' });
    const source = record('one', 'home', { paymentCode: 'PAY-1', firstName: 'Same', lastName: 'Name' });
    expect(resolveRotationPayrollEmployee(employee,
      [source, record('two', 'home', { firstName: 'Same', lastName: 'Name' })]).employee).toBe(source);
  });

  it('resolves legacy phone formatting but rejects conflicting identifiers', () => {
    const employee = rotation({ rotationSourceEmployeeId: undefined, canonicalEmployeeId: undefined,
      phoneNumber: '0899 401 993', paymentCode: 'PAY-1' });
    const source = record('old', 'home', { phoneNumber: '0899401993' });
    expect(resolveRotationPayrollEmployee(employee, [source]).employee).toBe(source);
    source.paymentCode = 'PAY-2';
    expect(resolveRotationPayrollEmployee(employee, [source]).issue).toBe('ambiguous-source');
  });

  it('requires a source location and rejects an ambiguous canonical identity', () => {
    expect(resolveRotationPayrollEmployee(rotation({ rotationSourceLocationId: undefined }),
      [original()]).issue).toBe('missing-source');
    expect(resolveRotationPayrollEmployee(rotation({ rotationSourceEmployeeId: undefined }),
      [original(), record('another', 'home', { canonicalEmployeeId: 'original' })]).issue).toBe('ambiguous-source');
  });

  it('deduplicates repeated snapshots and supports the current-user owner fallback', () => {
    const source = { uid: 'original' } as Employee;
    expect(resolveRotationPayrollEmployee(rotation(), [source, source], 'home').employee).toBe(source);
  });
});
