import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

const next = () => screen.getByRole('button', { name: 'หน้าถัดไป' });
const previous = () => screen.getByRole('button', { name: 'หน้าก่อนหน้า' });

describe('Pagination', () => {
  it('stays out of the way when everything fits on one page', () => {
    render(<Pagination page={1} pageSize={20} total={3} onPageChange={vi.fn()} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('says which page of how many, in Thai', () => {
    render(<Pagination page={2} pageSize={10} total={25} onPageChange={vi.fn()} />);

    expect(screen.getByText('หน้า 2 จาก 3')).toBeInTheDocument();
  });

  it('cannot go back from the first page', () => {
    render(<Pagination page={1} pageSize={1} total={3} onPageChange={vi.fn()} />);

    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it('cannot go past the last page', () => {
    render(<Pagination page={3} pageSize={1} total={3} onPageChange={vi.fn()} />);

    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
  });

  it('asks for the neighbouring page, never computes the offset itself', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={1} total={3} onPageChange={onPageChange} />);

    next().click();
    expect(onPageChange).toHaveBeenCalledWith(3);

    previous().click();
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  // A total of 0 is the empty state's business, not the pager's.
  it('stays out of the way when nothing matched', () => {
    render(<Pagination page={1} pageSize={20} total={0} onPageChange={vi.fn()} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
