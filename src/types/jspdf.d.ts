declare module 'jspdf' {
  export class jsPDF {
    setFontSize(size: number): void;
    text(text: string, x: number, y: number): void;
    addPage(): void;
    output(type: 'arraybuffer'): ArrayBuffer;
  }
}
