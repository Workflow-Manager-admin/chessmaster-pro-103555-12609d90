import React from 'react';
import { render, screen } from '@testing-library/react';
import ChessMasterPro from './ChessMasterPro';

describe('ChessMaster Pro', () => {
  test('renders the chess application', () => {
    render(<ChessMasterPro />);
    expect(screen.getByText(/Start Game/i)).toBeInTheDocument();
  });
  
  test('renders the chessboard', () => {
    render(<ChessMasterPro />);
    const board = document.querySelector('.cb-board');
    expect(board).toBeInTheDocument();
  });
  
  test('displays game status', () => {
    render(<ChessMasterPro />);
    expect(screen.getByText(/White's move/i)).toBeInTheDocument();
  });
});
