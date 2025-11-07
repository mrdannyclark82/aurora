/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SpinnerIcon } from './SpinnerIcon';

describe('SpinnerIcon', () => {
  it('renders correctly and matches snapshot', () => {
    const { container } = render(<SpinnerIcon />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('applies className prop correctly', () => {
    const { container } = render(<SpinnerIcon className="test-class" />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toHaveClass('test-class');
  });
});
