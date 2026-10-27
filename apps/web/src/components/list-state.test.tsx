import { render, screen } from '@testing-library/react';
import { ORPCError } from '@orpc/client';
import { describe, expect, it } from 'vitest';
import { ListState } from './list-state';

const rows = <li>สาขา 01</li>;

describe('ListState', () => {
  // AC-04. The four states are distinct: exactly one shows at a time, and none of them is a
  // blank panel. #5 lands this so every later list reuses the same four.
  it('shows a Thai loading message while the query is pending', () => {
    render(
      <ListState isPending error={null} isEmpty={false}>
        {rows}
      </ListState>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/กำลังโหลด/);
    expect(screen.queryByText('สาขา 01')).not.toBeInTheDocument();
  });

  it('shows the rows once they have arrived', () => {
    render(
      <ListState isPending={false} error={null} isEmpty={false}>
        {rows}
      </ListState>,
    );

    expect(screen.getByText('สาขา 01')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // AC-05.
  it('shows a Thai empty-state message rather than a blank panel', () => {
    render(
      <ListState isPending={false} error={null} isEmpty emptyMessage="ไม่พบสาขาที่ค้นหา">
        {rows}
      </ListState>,
    );

    expect(screen.getByText('ไม่พบสาขาที่ค้นหา')).toBeInTheDocument();
    expect(screen.queryByText('สาขา 01')).not.toBeInTheDocument();
  });

  it('falls back to a Thai empty message when the caller names none', () => {
    render(
      <ListState isPending={false} error={null} isEmpty>
        {rows}
      </ListState>,
    );

    expect(screen.getByText(/ไม่พบข้อมูล/)).toBeInTheDocument();
  });

  it("shows the API's own Thai message when the query failed", () => {
    const error = new ORPCError('STORE_NOT_FOUND', { message: 'ไม่พบสาขาที่ระบุ' });

    render(
      <ListState isPending={false} error={error} isEmpty={false}>
        {rows}
      </ListState>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('ไม่พบสาขาที่ระบุ');
    expect(screen.queryByText('สาขา 01')).not.toBeInTheDocument();
  });

  // A failed query also has no rows, so without this the error would read as "no data".
  it('prefers the error state over the empty state', () => {
    render(
      <ListState isPending={false} error={new Error('boom')} isEmpty>
        {rows}
      </ListState>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/ไม่พบข้อมูล/)).not.toBeInTheDocument();
  });
});
