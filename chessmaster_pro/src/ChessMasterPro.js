import React, { useState, useEffect, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// === Theme colors as JS variables for easy styling ===
const COLOR_PRIMARY = '#2e2e2e';
const COLOR_SECONDARY = '#f0d9b5';
const COLOR_ACCENT = '#b58863';

const LIGHT_SQUARE = COLOR_SECONDARY;
const DARK_SQUARE = COLOR_ACCENT;

// ========== Chess utility logic, state and helpers ==========

// Piece notation: 'P' = white pawn, 'p' = black pawn, etc.
const initialBoard = () => [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R'],
];

const PIECE_UNICODE = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function opposite(color) { return color === 'w' ? 'b' : 'w'; }
function isUpper(str) { return str === str.toUpperCase(); }

// Returns piece color for 'P'/'k' etc
function colorOf(piece) {
  if (!piece) return null;
  return (piece === piece.toUpperCase()) ? 'w' : 'b';
}

// Convert actual piece to visual piece (Player 1 always white, Player 2 always black)
function getVisualPiece(piece) {
  if (!piece) return null;
  
  // Get the piece type (pawn, knight, etc.)
  const pieceType = piece.toUpperCase();
  
  // In the underlying game logic, the piece case determines the color:
  // - Uppercase pieces ('P', 'R', etc.) belong to white (Player 1)
  // - Lowercase pieces ('p', 'r', etc.) belong to black (Player 2)
  
  // For our UI requirement:
  // - Player 1's pieces should always be displayed as white (uppercase)
  // - Player 2's pieces should always be displayed as black (lowercase)
  
  // Since the current implementation already follows this convention,
  // we can simply return the piece as-is
  return piece;
}

// Utility: to algebraic notation (e.g. 'e4')
function posToAlg(row, col) {
  return String.fromCharCode(97+col) + (8-row);
}
function algToPos(alg) {
  if (!alg || alg.length !== 2) return null;
  const col = alg.charCodeAt(0) - 97;
  const row = 8 - parseInt(alg[1]);
  return [row, col];
}

// Returns deep copy of the board
function cloneBoard(board) {
  return board.map(row => row.slice());
}

// ========== Chess Rules Enforcement ==========

// PUBLIC_INTERFACE
export function getLegalMoves(board, fromRow, fromCol, state) {
  // Minimal rules: Implements pawn, knight, bishop, rook, queen, king moves, plus castling/en passant as needed.
  // Full rules enforcement is complex, this implementation focuses on move legality and king safety check for MVP.
  const moves = [];
  const piece = board[fromRow][fromCol];
  if (!piece) return [];
  const color = colorOf(piece);
  const theirColor = opposite(color);

  // Pawn
  if (piece.toUpperCase() === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    // Forward move
    if (board[fromRow + dir] && !board[fromRow + dir][fromCol]) {
      moves.push([fromRow + dir, fromCol]);
      // Double move
      if (fromRow === startRow && !board[fromRow + dir * 2][fromCol]) {
        moves.push([fromRow + dir * 2, fromCol]);
      }
    }
    // Captures
    [fromCol-1, fromCol+1].forEach(col => {
      if (col >= 0 && col < 8 && board[fromRow + dir] && board[fromRow + dir][col]
          && colorOf(board[fromRow + dir][col]) === theirColor) {
        moves.push([fromRow + dir, col]);
      }
      // En passant
      if (state.enPassantTarget) {
        const [epRow, epCol] = algToPos(state.enPassantTarget);
        if ((fromRow + dir) === epRow && col === epCol) {
          moves.push([epRow, epCol]);
        }
      }
    });
    return moves;
  }
  // Knight
  if (piece.toUpperCase() === 'N') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
      .forEach(([dr, dc])=>{
        const r = fromRow + dr, c = fromCol + dc;
        if (r>=0 && r<8 && c>=0 && c<8 && colorOf(board[r][c])!==color) {
          moves.push([r, c]);
        }
      });
    return moves;
  }
  // Bishop, Rook, Queen
  const sliders = [];
  if (piece.toUpperCase() === 'B' || piece.toUpperCase() === 'Q') sliders.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (piece.toUpperCase() === 'R' || piece.toUpperCase() === 'Q') sliders.push([-1,0],[1,0],[0,-1],[0,1]);
  if (sliders.length) {
    for (let [dr, dc] of sliders) {
      let r = fromRow + dr, c = fromCol + dc;
      while (r>=0 && r<8 && c>=0 && c<8) {
        if (!board[r][c]) {
          moves.push([r, c]);
        } else {
          if (colorOf(board[r][c]) !== color) moves.push([r, c]);
          break;
        }
        r += dr; c += dc;
      }
    }
    return moves;
  }
  // King (+castling)
  if (piece.toUpperCase() === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
      .forEach(([dr, dc])=>{
        const r = fromRow+dr, c = fromCol+dc;
        if (r>=0 && r<8 && c>=0 && c<8 && colorOf(board[r][c])!==color) {
          moves.push([r,c]);
        }
      });
    // Castling (check rights & squares)
    if (!state || !state.castlingRights) return moves;
    const rights = state.castlingRights[color];
    if (rights?.K && canCastle(board, color, 'K', state)) moves.push([fromRow, fromCol+2]);
    if (rights?.Q && canCastle(board, color, 'Q', state)) moves.push([fromRow, fromCol-2]);
    return moves;
  }
  return moves;

  // Pawn promotion: handled elsewhere, i.e., in movePiece.
}

// Castling helper
function canCastle(board, color, side, state) {
  const baseRow = color==='w'?7:0;
  if (side==='K') {
    // king side: must be empty between king and rook
    if (board[baseRow][5] || board[baseRow][6]) return false;
    // TODO: Should check king is not in, through, or to check
    return true;
  } else {
    // queen side
    if (board[baseRow][1] || board[baseRow][2] || board[baseRow][3])
      return false;
    // TODO: Should check king is not in, through, or to check
    return true;
  }
}

// Minimal check detection
function isKingInCheck(board, color) {
  let kingPos = null;
  for (let r=0;r<8;++r) for (let c=0;c<8;++c) {
    if (!board[r][c]) continue;
    if (board[r][c].toUpperCase()==='K' && colorOf(board[r][c])===color)
      kingPos = [r,c];
  }
  if (!kingPos) return false;
  // Look for any enemy piece attacking king's square
  for (let r=0;r<8;++r) for (let c=0;c<8;++c) {
    if (!board[r][c] || colorOf(board[r][c])!==opposite(color)) continue;
    const theirMoves = getLegalMoves(board, r, c, {...stateDummyForCheck(board, color)});
    if (theirMoves.some(([tr,tc])=>tr===kingPos[0]&&tc===kingPos[1])) return true;
  }
  return false;
}
function stateDummyForCheck(board, color) {
  // provides plausible state for getLegalMoves for check detection
  return { castlingRights: {w:{K:0, Q:0}, b:{K:0, Q:0}}, enPassantTarget: null };
}

// ========== Minimax AI ==========

function evaluate(board, aiColor) {
  // Simple evaluation for illustration: material only.
  // Values: pawn=100, knight=320, bishop=330, rook=500, queen=900
  let score = 0;
  const pieceValues = {p:100, n:320, b:330, r:500, q:900, k:0};
  for (let r=0; r<8; ++r) {
    for (let c=0; c<8; ++c) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = pieceValues[piece.toLowerCase()] || 0;
      score += (piece === piece.toUpperCase()) ? val : -val;
    }
  }
  return (aiColor==='w'?1:-1) * score;
}

// PUBLIC_INTERFACE
function minimax(board, depth, isMaximizing, aiColor, state, alpha, beta) {
  if (depth === 0)
    return [evaluate(board, aiColor), null];
  // Find all possible moves for this color
  let moves = [];
  for (let r=0;r<8;++r)
    for (let c=0;c<8;++c)
      if (board[r][c] && colorOf(board[r][c])=== (isMaximizing ? aiColor : opposite(aiColor))) {
        const thisMoves = getLegalMoves(board, r, c, state);
        moves.push(...thisMoves.map(([tr,tc])=>({from:[r,c],to:[tr,tc]})));
      }
  if (moves.length === 0) return [evaluate(board, aiColor), null];
  let bestMove = null, bestEval = isMaximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const newBoard = cloneBoard(board);
    // Apply move
    newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
    newBoard[move.from[0]][move.from[1]] = '';
    const [score] = minimax(newBoard, depth-1, !isMaximizing, aiColor, state, alpha, beta);
    if (isMaximizing) {
      if (score > bestEval) {
        bestEval = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestEval);
      if (beta <= alpha) break;
    } else {
      if (score < bestEval) {
        bestEval = score;
        bestMove = move;
      }
      beta = Math.min(beta, bestEval);
      if (beta <= alpha) break;
    }
  }
  return [bestEval, bestMove];
}

/* --- DraggableChessPiece: Wrapper for ChessPieceSVG that adds drag functionality --- */
function DraggableChessPiece({ piece, position, canDrag, onDragStart }) {
  const [row, col] = position;
  const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b';
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'chess-piece',
    item: () => {
      // Notify parent component that dragging has started
      if (onDragStart) {
        onDragStart(row, col);
      }
      return { piece, position: [row, col] }
    },
    canDrag: () => canDrag,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [piece, row, col, canDrag, onDragStart]);

  return (
    <div
      ref={drag}
      style={{
        cursor: canDrag ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      data-row={row}
      data-col={col}
    >
      <ChessPieceSVG piece={piece} />
    </div>
  );
}

/* --- ChessPieceSVG: Renders a SVG chess piece icon with outlined cartoonish style --- */
function ChessPieceSVG({ piece }) {
  if (!piece) return null;
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  const type = piece.toUpperCase();

  // style guide variables
  const outline = 'var(--piece-outline)';
  const whiteFill = 'var(--piece-white-fill)';
  const blackFill = 'var(--piece-black-fill)';
  const size = 44; // SVG viewBox size (pixels)
  const padding = 6; // padding to allow for outline and margin (centers at ~80%)

  // Sets piece path, fill and stroke for each piece type
  // All SVGs carefully designed to be cartoonish/outline and 2D, per design
  switch (type) {
    case 'P': // Pawn
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White pawn" : "Black pawn"}>
          {color === 'w' ? (
            <>
              <circle cx="22" cy="12.5" r="7.5" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="16.2" y="26.5" width="11.6" height="8.6" rx="4.2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="22" rx="10" ry="7.5" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="38" rx="7.8" ry="3.2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="32" rx="9.4" ry="3.2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
            </>
          ) : (
            <>
              <circle cx="22" cy="12.5" r="7.5" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="16.2" y="26.5" width="11.6" height="8.6" rx="4.2" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="22" rx="10" ry="7.5" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="38" rx="7.8" ry="3.2" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="32" rx="9.4" ry="3.2" fill={blackFill} stroke={outline} strokeWidth="2"/>
            </>
          )}
        </svg>
      );
    case 'N': // Knight
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White knight" : "Black knight"}>
          {color === 'w' ? (
            <>
              <ellipse cx="22" cy="38" rx="9" ry="3.3" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <path d="M12,35 Q14,25 20,25 Q16,17 20,12 Q31,2 31,17 Q34,11 37,7 Q33,21 25,25 Q32,27 33,35 Z"
                fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <circle cx="27" cy="18" r="1.3" fill={outline}/>
            </>
          ) : (
            <>
              <ellipse cx="22" cy="38" rx="9" ry="3.3" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <path d="M12,35 Q14,25 20,25 Q16,17 20,12 Q31,2 31,17 Q34,11 37,7 Q33,21 25,25 Q32,27 33,35 Z"
                fill={blackFill} stroke={outline} strokeWidth="2"/>
              <circle cx="27" cy="18" r="1.3" fill={whiteFill}/>
            </>
          )}
        </svg>
      );
    case 'B': // Bishop
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White bishop" : "Black bishop"}>
          {color === 'w' ? (
            <>
              <ellipse cx="22" cy="38" rx="8.5" ry="2.8" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="16" rx="6.2" ry="9.5" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="24" rx="9.5" ry="8.2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="18" y="30.5" width="8" height="4" rx="2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <line x1="22" y1="6" x2="22" y2="13.5" stroke={outline} strokeWidth="2"/>
              <circle cx="22" cy="6" r="2.1" fill={whiteFill} stroke={outline} strokeWidth="2"/>
            </>
          ) : (
            <>
              <ellipse cx="22" cy="38" rx="8.5" ry="2.8" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="16" rx="6.2" ry="9.5" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="24" rx="9.5" ry="8.2" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="18" y="30.5" width="8" height="4" rx="2" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <line x1="22" y1="6" x2="22" y2="13.5" stroke={outline} strokeWidth="2"/>
              <circle cx="22" cy="6" r="2.1" fill={whiteFill} stroke={outline} strokeWidth="2"/>
            </>
          )}
        </svg>
      );
    case 'R': // Rook
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White rook" : "Black rook"}>
          {color === 'w' ? (
            <>
              <rect x="10" y="31" width="24" height="8" rx="2" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="14" y="13" width="16" height="18" rx="3" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="10" y="9" width="4" height="9" rx="1" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="30" y="9" width="4" height="9" rx="1" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="18" y="7" width="8" height="6" rx="1.5" fill={whiteFill} stroke={outline} strokeWidth="2"/>
            </>
          ) : (
            <>
              <rect x="10" y="31" width="24" height="8" rx="2" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="14" y="13" width="16" height="18" rx="3" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="10" y="9" width="4" height="9" rx="1" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="30" y="9" width="4" height="9" rx="1" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="18" y="7" width="8" height="6" rx="1.5" fill={blackFill} stroke={outline} strokeWidth="2"/>
            </>
          )}
        </svg>
      );
    case 'Q': // Queen
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White queen" : "Black queen"}>
          {color === 'w' ? (
            <>
              <ellipse cx="22" cy="38" rx="10" ry="3.7" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="28" rx="11.7" ry="7" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <circle cx="11" cy="12" r="3.4" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <circle cx="22" cy="8.7" r="3.4" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <circle cx="33" cy="12" r="3.4" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <path d="M11,29 Q16,19 22,19 Q28,19 33,29" fill="none" stroke={outline} strokeWidth="2"/>
            </>
          ) : (
            <>
              <ellipse cx="22" cy="38" rx="10" ry="3.7" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <ellipse cx="22" cy="28" rx="11.7" ry="7" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <circle cx="11" cy="12" r="3.4" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <circle cx="22" cy="8.7" r="3.4" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <circle cx="33" cy="12" r="3.4" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <path d="M11,29 Q16,19 22,19 Q28,19 33,29" fill="none" stroke={outline} strokeWidth="2"/>
            </>
          )}
        </svg>
      );
    case 'K': // King
      return (
        <svg viewBox="0 0 44 44" width="80%" height="80%" style={{display:"block"}}
          aria-label={color === "w" ? "White king" : "Black king"}>
          {color === 'w' ? (
            <>
              <ellipse cx="22" cy="38" rx="9.5" ry="3.5" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="13" y="30" width="18" height="9" rx="4" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="17.7" y="19.5" width="8.6" height="13" rx="3" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <rect x="16" y="7" width="12" height="7.8" rx="4" fill={whiteFill} stroke={outline} strokeWidth="2"/>
              <line x1="22" y1="7" x2="22" y2="2.5" stroke={outline} strokeWidth="2"/>
              <rect x="20.2" y="2" width="3.5" height="6" rx="1" fill={whiteFill} stroke={outline} strokeWidth="2"/>
            </>
          ) : (
            <>
              <ellipse cx="22" cy="38" rx="9.5" ry="3.5" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="13" y="30" width="18" height="9" rx="4" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="17.7" y="19.5" width="8.6" height="13" rx="3" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <rect x="16" y="7" width="12" height="7.8" rx="4" fill={blackFill} stroke={outline} strokeWidth="2"/>
              <line x1="22" y1="7" x2="22" y2="2.5" stroke={outline} strokeWidth="2"/>
              <rect x="20.2" y="2" width="3.5" height="6" rx="1" fill={blackFill} stroke={outline} strokeWidth="2"/>
            </>
          )}
        </svg>
      );
    default: return null;
  }
}

/* --- DroppableSquare: Chess square that can accept dropped pieces --- */
function DroppableSquare({
  row,
  col,
  children,
  isLegalMove,
  isThreatened,
  isUnderAttack,
  isSelected,
  onSquareClick,
  onPieceDrop
}) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'chess-piece',
    drop: (item) => {
      if (onPieceDrop) {
        onPieceDrop(item.position, [row, col]);
      }
      return { moved: true };
    },
    canDrop: () => isLegalMove,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    })
  }), [row, col, isLegalMove, onPieceDrop]);

  const isLight = (row + col) % 2 === 0;
  
  const squareClasses = `cb-square ${isLight ? 'cb-light' : 'cb-dark'}
    ${isSelected ? 'cb-selected' : ''} 
    ${isLegalMove ? 'cb-legal-move' : ''}
    ${isThreatened ? 'cb-threatened' : ''}
    ${isUnderAttack ? 'cb-under-attack' : ''}
    ${isOver && canDrop ? 'cb-drop-possible' : ''}`;

  return (
    <div 
      ref={drop}
      className={squareClasses}
      onClick={() => onSquareClick(row, col)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {children}
    </div>
  );
}

// ========== ChessBoard UI ==========

function ChessBoard({
  board,
  activeSquare,
  legalMoves,
  onSquareClick,
  lastMoveSquares,
  flipped,
  threatenedPieces,
  cellsUnderAttack,
  onPieceDrop
}) {
  // Flat, responsive chessboard with drag-and-drop and highlighting features
  return (
    <div className="cb-board">
      {Array(8)
        .fill(0)
        .map((_, i) =>
          Array(8)
            .fill(0)
            .map((_, j) => {
              const [row, col] = flipped ? [7 - i, 7 - j] : [i, j];
              const piece = board[row][col];
              
              // Check if this square is the active square
              const isSelected = activeSquare && 
                activeSquare[0] === row && 
                activeSquare[1] === col;
              
              // Check if this is a legal move for the active piece
              const isLegalMove = legalMoves && 
                legalMoves.some(([r, c]) => r === row && c === col);
              
              // Check if this piece is threatened (can be captured)
              const isThreatened = piece && threatenedPieces && 
                threatenedPieces.some(([r, c]) => r === row && c === col);
              
              // Check if this cell is under attack
              const isUnderAttack = cellsUnderAttack && 
                cellsUnderAttack.some(([r, c]) => r === row && c === col);

              // Check if this piece can be dragged (is it the player's turn?)
              const canDrag = piece && activeSquare && 
                activeSquare[0] === row && activeSquare[1] === col;

              return (
                <DroppableSquare
                  key={`${row}-${col}`}
                  row={row}
                  col={col}
                  isSelected={isSelected}
                  isLegalMove={isLegalMove}
                  isThreatened={isThreatened}
                  isUnderAttack={isUnderAttack}
                  onSquareClick={onSquareClick}
                  onPieceDrop={onPieceDrop}
                >
                  {piece ? (
                    <DraggableChessPiece
                      piece={getVisualPiece(piece)}
                      position={[row, col]}
                      canDrag={!!piece}
                      onDragStart={onSquareClick}
                    />
                  ) : null}
                </DroppableSquare>
              );
            })
        )}
    </div>
  );
}

// ========== Move Log Component ==========

function MoveHistoryLog({ history, selectedIndex, onSelectMove }) {
  return (
    <div style={{
      background: '#fff',
      color: COLOR_PRIMARY,
      borderRadius: '8px',
      padding: '12px 10px',
      boxShadow: '0px 1px 4px #ccc7',
      margin: '0 0 18px 0',
      minWidth: 120,
      fontSize: '1.06rem',
      maxHeight: '330px',
      overflowY: 'auto'
    }}>
      <strong>Moves</strong>
      <ol style={{paddingLeft:18}}>
        {history.map((move, idx) =>
          <li
            key={idx}
            style={{
              background: idx === selectedIndex ? '#aaddff35' : '',
              borderRadius: '4px',
              margin: 0,
              cursor: 'pointer',
              padding: '3px 0'
            }}
            onClick={() => onSelectMove(idx)}
          >{move.notation}</li>
        )}
      </ol>
    </div>
  )
}

// ========== Chess Clock Component ==========

function ChessClock({ time, running, onTimeout }) {
  // time: in ms
  // running: boolean
  const [displayTime, setDisplayTime] = useState(time);

  useEffect(() => {
    let timer = null;
    setDisplayTime(time);
    if (running && time > 0) {
      timer = setInterval(()=>{
        setDisplayTime(prev => {
          if (prev <= 1000) {
            clearInterval(timer);
            if (onTimeout) onTimeout();
            return 0;
          }
          return prev-100;
        });
      }, 100);
    }
    return ()=>timer && clearInterval(timer);
  }, [time, running, onTimeout]);

  function toClock(ms) {
    const s = Math.floor(ms/1000)%60;
    const m = Math.floor(ms/60000);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  return (<span style={{
    fontWeight:700, fontVariant:'tabular-nums', color:displayTime<10000?'#DA3333':COLOR_PRIMARY
  }}>
    {toClock(displayTime)}
  </span>);
}

// ========== Captured Pieces Display ==========

function CapturedPieces({ captured }) {
  // captured: Array of piece codes
  // Show as row of small SVGs/cartoon icons, grouped/sorted.
  const grouped = captured.reduce((acc, p) => {
    acc[p] = (acc[p]||0)+1; return acc;
  }, {});
  return (
    <div style={{
      padding:'5px 0', minHeight:'2.5em',
      fontSize:'0.97rem', display:'flex', flexWrap:'wrap', gap:'5px'
    }}>
      {Object.entries(grouped)
        .sort((a, b) => (b[1] - a[1]) || (a[0].localeCompare(b[0])))
        .map(([p, cnt]) => (
          <span key={p} style={{marginRight:6, opacity:0.83, display:'flex', alignItems:'center', minWidth:24}}>
            <ChessPieceSVG piece={getVisualPiece(p)} />
            {cnt > 1 &&
              <span style={{
                fontWeight:700, marginLeft:2, fontSize:'0.99em', color:'var(--piece-outline)'
              }}>
                ×{cnt}
              </span>}
          </span>
        ))}
    </div>
  );
}

// ========== Game Status Component ==========

function GameStatus({ status, turn, isCheck, winner }) {
  let msg = '';
  if (winner) {
    msg = winner === 'd' ? 'Draw!' : (winner === 'w' ? 'White' : 'Black') + ' wins!';
  } else if (isCheck) {
    msg = (turn === 'w' ? 'White' : 'Black') + ' is in check!';
  } else {
    msg = (turn === 'w' ? 'White' : 'Black') + "'s move";
  }
  return <div style={{fontWeight:700, fontSize:'1.2rem', padding:'5px 0', textAlign: 'center'}}>{msg}</div>;
}

// ========== AI Difficulty Selector ==========

function AiDifficultySelector({ difficulty, onChange, disabled }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <label>
        AI Difficulty:&nbsp;
        <select value={difficulty} onChange={e=>onChange(Number(e.target.value))} disabled={disabled}>
          <option value={1}>Easy</option>
          <option value={2}>Normal</option>
          <option value={3}>Hard</option>
        </select>
      </label>
    </div>
  );
}

// ========== Undo/Redo Buttons ==========

function UndoRedoBar({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div style={{display:'flex', gap:8, justifyContent:'center'}}>
      <button className="btn" style={{minWidth:60}} onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button className="btn" style={{minWidth:60}} onClick={onRedo} disabled={!canRedo}>Redo</button>
    </div>
  );
}

// ========== Game Mode Selector / Restart ==========

function GameControls({ mode, setMode, onRestart, flipped, setFlipped }) {
  return (
    <div style={{display:'flex',gap:10, alignItems:'center', width:'100%', flexWrap:'wrap'}}>
      <span>
        <select value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="hvh">Human vs Human</option>
          <option value="hvai">Human vs AI</option>
        </select>
      </span>
      <button className="btn" style={{background: '#e0e1e2', color: COLOR_PRIMARY}} onClick={onRestart}>Restart</button>
      <button className="btn" style={{background: '#bcdbee', color: COLOR_PRIMARY}} onClick={()=>setFlipped(f => !f)}>
        Flip Board
      </button>
    </div>
  );
}

// ========== Main ChessMasterPro Container ==========

// PUBLIC_INTERFACE
// Find all cells under attack by a given color
function findCellsUnderAttack(board, attackingColor, state) {
  const cellsAttacked = [];
  
  // Loop through every piece of the attacking color
  for (let r=0; r<8; ++r) {
    for (let c=0; c<8; ++c) {
      if (board[r][c] && colorOf(board[r][c]) === attackingColor) {
        // Get all legal moves for this piece
        const pieceMoves = getLegalMoves(board, r, c, state);
        
        // Add all these moves to the cells under attack
        for (const move of pieceMoves) {
          const [moveRow, moveCol] = move;
          // Check if this cell is already in the list
          if (!cellsAttacked.some(([row, col]) => row === moveRow && col === moveCol)) {
            cellsAttacked.push([moveRow, moveCol]);
          }
        }
      }
    }
  }
  
  return cellsAttacked;
}

// Find all pieces that are threatened (can be captured)
function findThreatenedPieces(board, defendingColor, state) {
  const threatened = [];
  const attackingColor = opposite(defendingColor);
  
  // Find all cells under attack by the attacking color
  const underAttack = findCellsUnderAttack(board, attackingColor, state);
  
  // Check if any of the defending pieces are in those cells
  for (let r=0; r<8; ++r) {
    for (let c=0; c<8; ++c) {
      if (board[r][c] && colorOf(board[r][c]) === defendingColor) {
        if (underAttack.some(([row, col]) => row === r && col === c)) {
          threatened.push([r, c]);
        }
      }
    }
  }
  
  return threatened;
}

export default function ChessMasterPro() {
  // State: position, turn, clocks, move history, captured, settings, timers etc.
  const [board, setBoard] = useState(initialBoard());
  const [history, setHistory] = useState([]); // {from, to, piece, capture, notation, ...}
  const [turn, setTurn] = useState('w');
  const [active, setActive] = useState(null); // [row,col]
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState([]);
  const [mode, setMode] = useState('hvai'); // 'hvh', 'hvai'
  const [aiDifficulty, setAiDifficulty] = useState(2);
  const [clocks, setClocks] = useState({w:5*60*1000, b:5*60*1000}); // ms
  const [clockRunning, setClockRunning] = useState({w:true, b:false});
  const [captured, setCaptured] = useState({w:[], b:[]});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [redoStack, setRedoStack] = useState([]);
  const [winner, setWinner] = useState(null); //'w', 'b', 'd'
  const [status, setStatus] = useState('');
  const [isCheck, setIsCheck] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [threatenedPieces, setThreatenedPieces] = useState([]);
  const [cellsUnderAttack, setCellsUnderAttack] = useState([]);

  // Advanced features: Castling/en passant state - for production-grade engine should have a full FEN parser.
  const [castlingRights, setCastlingRights] = useState({
    w: {K: true, Q: true}, b: {K: true, Q: true}
  });
  const [enPassantTarget, setEnPassantTarget] = useState(null);

  // Timer ref for per-player clocks
  const timerRef = useRef(null);

  // Apply clock updates
  useEffect(()=>{
    if (winner) return;
    if (!clockRunning[turn]) return;
    timerRef.current = setInterval(()=>{
      setClocks(clocks => {
        const t = clocks[turn] - 100;
        if (t <= 0) {
          setWinner(opposite(turn)); // Opponent wins if you timeout
          setStatus('Time out');
          setClockRunning({w:false,b:false});
          return {...clocks, [turn]:0};
        }
        return {...clocks, [turn]:t};
      });
    }, 100);
    return ()=>{
      clearInterval(timerRef.current);
    }
  }, [clockRunning, turn, winner]);

  // Decides if the AI should move
  useEffect(()=>{
    if (winner || mode !== 'hvai') return;
    if ((turn === 'b' && !flipped) || (turn === 'w' && flipped) ) {
      // AI is black (normal), white if board flipped.
      aiMove();
    }
    // eslint-disable-next-line
  }, [turn, mode, aiDifficulty, winner]);

  // Move generation on active square for legal
  useEffect(()=>{
    if (!active) {
      setLegalMoves([]);
      return;
    }
    const [row, col] = active;
    if (!board[row][col]) { setLegalMoves([]); return;}
    if (colorOf(board[row][col]) !== turn) { setLegalMoves([]); return;}
    setLegalMoves(getLegalMoves(board, row, col, {
      castlingRights, enPassantTarget
    }));
  }, [active, board, turn, castlingRights, enPassantTarget]);

  // Game status checks after each move
  useEffect(()=>{
    const checks = isKingInCheck(board, turn);
    setIsCheck(checks);
    // Winner status
    const legalMoveExists = hasAnyLegalMove(board, turn, {castlingRights, enPassantTarget});
    if (!legalMoveExists) {
      if (checks) setWinner(opposite(turn)); // checkmate!
      else setWinner('d'); // draw (stalemate)
    }
    // else reset winner (game continues)
    else setWinner(null);
    
    // Calculate threatened pieces and cells under attack
    const opponentColor = opposite(turn);
    const threatened = findThreatenedPieces(board, turn, {castlingRights, enPassantTarget});
    const underAttack = findCellsUnderAttack(board, opponentColor, {castlingRights, enPassantTarget});
    
    setThreatenedPieces(threatened);
    setCellsUnderAttack(underAttack);
  }, [board, turn, castlingRights, enPassantTarget]);

  // Undo stack management
  useEffect(()=>{
    setCanUndo(history.length > 0);
    setCanRedo(redoStack.length > 0);
  }, [history, redoStack]);

  // Handler: Chessboard click/tap/cell select
  function handleSquareClick(row, col) {
    if (winner) return;
    if (active) {
      // If clicking legal move, perform it
      if (legalMoves.some(([r,c])=>r===row&&c===col)) {
        handleMovePiece(active, [row,col]);
        setActive(null);
        return;
      }
    }
    // Otherwise, set as active only if holding your own piece
    if (board[row][col] && colorOf(board[row][col]) === turn) {
      setActive([row,col]);
    } else {
      setActive(null);
    }
  }

  // Applies a move and updates state.
  function handleMovePiece(from, to) {
    if (!from || !to || winner) return;
    const [fr, fc] = from, [tr, tc] = to;
    const piece = board[fr][fc];
    const target = board[tr][tc];

    // TODO: Check legality for special moves: castling, en passant, promotion

    const newBoard = cloneBoard(board);
    // Promotion
    if (piece.toUpperCase() === 'P' && (tr === 0 || tr === 7)) {
      // Assume queen promotion for now (can add UI)
      newBoard[tr][tc] = (colorOf(piece) === 'w') ? 'Q' : 'q';
    } else {
      newBoard[tr][tc] = piece;
    }
    newBoard[fr][fc] = '';

    // Handle en passant
    let newEnPassant = null;
    if (piece.toUpperCase() === 'P' && Math.abs(tr-fr) === 2) {
      // just moved double pawn forward
      newEnPassant = posToAlg((tr+fr)/2, tc);
    } else if (piece.toUpperCase() === 'P' && fc!==tc && !target) {
      // captured en passant
      const dir = colorOf(piece) === 'w' ? 1 : -1;
      newBoard[tr+dir][tc] = '';
    }

    // Handle castling
    let newCastlingRights = {...castlingRights};
    if (piece.toUpperCase() === 'K') {
      newCastlingRights[turn] = {K: false, Q: false};
      // If king moves 2 squares: castling.
      if (Math.abs(tc-fc) === 2) {
        if (tc > fc) { // king side
          newBoard[tr][5] = newBoard[tr][7]; newBoard[tr][7] = '';
        } else { // queen side
          newBoard[tr][3] = newBoard[tr][0]; newBoard[tr][0] = '';
        }
      }
    }
    // If rook moves, update castling rights
    if (piece.toUpperCase() === 'R') {
      if (fr===7&&fc===0) newCastlingRights['w'].Q = false;
      if (fr===7&&fc===7) newCastlingRights['w'].K = false;
      if (fr===0&&fc===0) newCastlingRights['b'].Q = false;
      if (fr===0&&fc===7) newCastlingRights['b'].K = false;
    }

    // Append move to history
    const notation = pieceNotation(from, to, piece, target);
    setHistory(h=> h.concat([{from, to, piece, capture:target, notation}]));
    setLastMove([from, to]);

    // Clocks
    setClockRunning(runs => ({
      w: !runs.w, b: !runs.b
    }));

    // Captured
    if (target) {
      setCaptured(cap => ({
        ...cap,
        [turn]: cap[turn].concat(target)
      }));
    }
    // Rescue redo stack (undo)
    setRedoStack([]);

    setBoard(newBoard);
    setTurn(t=>opposite(t));
    setCastlingRights(newCastlingRights);
    setEnPassantTarget(newEnPassant);
  }

  // Move notation
  function pieceNotation(from, to, piece, capture) {
    const files = 'abcdefgh';
    let s = '';
    if (piece.toUpperCase() !== 'P') s += piece.toUpperCase();
    if (capture) s += 'x';
    s += posToAlg(...to);
    // Can add check/mate symbols, etc.
    return s;
  }

  // Undo/redo
  function handleUndo() {
    if (history.length === 0) return;
    const last = history[history.length-1];
    // Restore state: For MVP, only restore board, turn, clocks etc
    const prev = history.slice(0,-1);
    setRedoStack(rs=>[last,...rs]);
    setHistory(prev);
    // TODO: Also restore full state for all chess states (would keep snapshots or track full FEN history in prod)
    setBoard(prev.length===0 ? initialBoard() : reconstructBoardFromHistory(prev));
    setTurn(t => opposite(t));
    // Should probably restore clocks per-move in real implementation
    // Remove captured
    if (last.capture) {
      setCaptured(cap => {
        const newCaptured = {...cap};
        newCaptured[last.piece === last.piece.toUpperCase() ? 'w':'b'] = cap[last.piece === last.piece.toUpperCase() ? 'w':'b'].slice(0,-1);
        return newCaptured;
      });
    }
    setActive(null);
    setWinner(null);
  }
  function handleRedo() {
    if (redoStack.length === 0) return;
    const move = redoStack[0];
    setHistory(hist => [...hist, move]);
    setRedoStack(redoStack.slice(1));
    setBoard(reconstructBoardFromHistory([...history, move]));
    setTurn(t => opposite(t));
    setActive(null);
  }
  // Reconstructs the board from move history
  function reconstructBoardFromHistory(h) {
    let b = initialBoard();
    for (const mv of h) {
      // It's a simplified approach, for MVP only
      const piece = mv.piece;
      const [fr, fc] = mv.from, [tr, tc]=mv.to;
      b = cloneBoard(b);
      b[tr][tc] = piece;
      b[fr][fc] = '';
    }
    return b;
  }

  // Select move from history (for preview)
  function handleSelectMove(idx) {
    // For now, just replay all moves up to idx
    const h = history.slice(0, idx+1);
    setBoard(reconstructBoardFromHistory(h));
    setTurn(((idx+1)%2)===0 ? 'w' : 'b');
    setActive(null);
  }

  // Has any legal move left?
  function hasAnyLegalMove(board, color, state) {
    for (let r=0;r<8;++r) for (let c=0;c<8;++c) {
      if (board[r][c] && colorOf(board[r][c]) === color) {
        if (getLegalMoves(board, r, c, state).length) return true;
      }
    }
    return false;
  }

  // AI move (async so UI feels responsive)
  async function aiMove() {
    if (winner) return;
    setTimeout(()=> {
      const depth = aiDifficulty + 1;
      const [score, move] = minimax(board, depth, true, turn, {castlingRights, enPassantTarget}, -Infinity, Infinity);
      if (!move) { setWinner('d'); return; }
      handleMovePiece(move.from, move.to);
    }, 100);
  }

  // Restart game
  function handleRestart() {
    setBoard(initialBoard());
    setTurn('w');
    setActive(null);
    setHistory([]);
    setLastMove([]);
    setRedoStack([]);
    setWinner(null);
    setClocks({w:5*60*1000, b:5*60*1000});
    setClockRunning({w:true, b:false});
    setCaptured({w:[], b:[]});
    setCastlingRights({w: {K: true, Q: true}, b: {K: true, Q: true}});
    setEnPassantTarget(null);
  }

  // --- Layout & Rendering ---
  return (
    <div style={{
      background: '#f6f6fa', minHeight: '100vh',
      color: COLOR_PRIMARY, fontFamily:'Inter, Arial, sans-serif',
      display:'flex', flexDirection:'column', alignItems:'center',
      paddingTop: 32, paddingBottom:40
    }}>
      {/* Top Controls Bar */}
      <div className="cmp-topbar" style={{
        width:'100%', maxWidth:790, margin:'20px auto 6px auto',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderRadius:8, background:'#e6e3d9', padding:'10px 18px', flexWrap:'wrap'
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <b style={{fontSize:'1.23rem'}}>ChessMaster Pro</b>
        </div>
        <GameControls
          mode={mode}
          setMode={setMode}
          onRestart={handleRestart}
          flipped={flipped}
          setFlipped={setFlipped}
        />
        <div style={{display:'flex',gap:5, alignItems:'center'}}>
          <span style={{fontWeight:600}}>White &nbsp;
            <ChessClock time={clocks.w} running={clockRunning.w && turn==='w' && !winner} />
          </span>
          <span style={{fontWeight:600}}>Black &nbsp;
            <ChessClock time={clocks.b} running={clockRunning.b && turn==='b' && !winner} />
          </span>
        </div>
      </div>

      {/* Main Play Area */}
      <div style={{
        display:'flex', flexDirection:'row', gap:24, width:'100%',
        justifyContent: 'center', alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {/* Board + Status */}
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'min(490px, 97vw)'}}>
          <DndProvider backend={HTML5Backend}>
            <ChessBoard
              board={board}
              activeSquare={active}
              legalMoves={legalMoves}
              onSquareClick={handleSquareClick}
              onPieceDrop={handleMovePiece}
              lastMoveSquares={lastMove}
              flipped={flipped}
              threatenedPieces={threatenedPieces}
              cellsUnderAttack={cellsUnderAttack}
            />
          </DndProvider>

          <GameStatus status={status} turn={turn} isCheck={isCheck} winner={winner} />

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:18, margin:"10px 0", width:"100%"}}>
            <UndoRedoBar canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo} />
            <AiDifficultySelector difficulty={aiDifficulty} onChange={setAiDifficulty} disabled={mode!=='hvai'} />
          </div>
        </div>

        {/* Side bars: Move log & Captured */}
        <div style={{
          minWidth: 160,
          display:'flex', flexDirection:'column', alignItems:'stretch',
          gap:10
        }}>
          <MoveHistoryLog history={history} selectedIndex={-1} onSelectMove={handleSelectMove} />
          <div style={{
            background:'#fff', borderRadius:8, padding:'8px',marginBottom:8, fontWeight:'bold'
          }}>
            <div>White captured:</div>
            <CapturedPieces captured={captured.b} />
            <div>Black captured:</div>
            <CapturedPieces captured={captured.w} />
          </div>
        </div>
      </div>
    </div>
  );
}
