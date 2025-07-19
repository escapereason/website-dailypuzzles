# Advanced Cipher Types (Archived - Too Complex)

## Expert Level Ciphers (Removed from main system)

### **9. Alternating Caesar**
**How it works:** Different shift for odd and even letter positions
- **Pattern:** Odd positions (1st, 3rd, 5th...) shift +3, Even positions (2nd, 4th, 6th...) shift +7
- **Example with HELLO:**
  - H (position 1, odd) + 3 = K
  - E (position 2, even) + 7 = L
  - L (position 3, odd) + 3 = O
  - L (position 4, even) + 7 = S
  - O (position 5, odd) + 3 = R
  - Result: HELLO → KLOSR
- **Why removed:** Too complex for daily puzzles

### **10. Keyword Caesar**
**How it works:** Shift amount determined by a secret keyword
- **Method:** Each letter of keyword determines shift for corresponding position
- **Example with keyword "CODE":**
  - C = 3rd letter = shift +3
  - O = 15th letter = shift +15
  - D = 4th letter = shift +4
  - E = 5th letter = shift +5
- **Why removed:** Requires additional keyword management

### **11. Rail Fence Cipher**
**How it works:** Write message in zigzag pattern across multiple "rails"
- **Method:** 
  1. Write letters in zigzag pattern
  2. Read off each rail horizontally
- **Example with HELLO (2 rails):**
  ```
  Rail 1: H . L . O
  Rail 2: . E . L .
  ```
  Read: Rail 1 = HLO, Rail 2 = EL → Combined = HLOEL
- **Why removed:** Visual/spatial complexity inappropriate for chat interface

### **12. Polybius Square**
**How it works:** Replace letters with coordinate pairs using a 5x5 grid
- **Grid setup:**
  ```
     1  2  3  4  5
  1  A  B  C  D  E
  2  F  G  H  I/J K
  3  L  M  N  O  P
  4  Q  R  S  T  U
  5  V  W  X  Y  Z
  ```
- **Method:** Each letter becomes row,column coordinates
- **Example:** HELLO → 23 15 31 31 34
- **Why removed:** Number format too different from letter-based puzzles

These ciphers were deemed too complex for the daily puzzle format and user experience goals.