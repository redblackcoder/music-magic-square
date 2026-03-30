# OCR Test Suite

Data-driven tests for digit and sum recognition. Tests call the same `recognizeCellFromImageData` function the app uses, ensuring test-app parity.

## Running Tests

```bash
npm test
```

## Adding Test Cases

### Single cell images

Place images in `fixtures/cells/` (png or jpg), then add entries to `CELL_CASES` in `scan.test.ts`:

```ts
{ file: 'my_digit_4.png', expected: { kind: 'single', dur: '1/4' } },
{ file: 'my_tied_2_plus_4.jpg', expected: { kind: 'tied', first: '1/8', second: '1/4' } },
```

### Full grid images

Place 4x4 grid photos in `fixtures/grids/`, then add entries to `GRID_CASES` with the expected 4x4 `CellValue[][]`.

## Fixtures

```
fixtures/
  cells/          ← individual digit/sum images (28x28 or any size)
  grids/          ← full 4x4 grid photos
```

Tests skip gracefully when fixture files are missing.

## Duration Mapping

| Number | CellValue |
|--------|-----------|
| 1      | `{ kind: 'single', dur: '1/16' }` |
| 2      | `{ kind: 'single', dur: '1/8' }` |
| 4      | `{ kind: 'single', dur: '1/4' }` |
| 8      | `{ kind: 'single', dur: '1/2' }` |
| 2+4    | `{ kind: 'tied', first: '1/8', second: '1/4' }` |
