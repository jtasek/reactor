export class Sequence {
  private counter: number;
  private available: Set<number>;

  constructor(available?: number[], start: number = 1) {
    this.counter = start;
    this.available = new Set<number>(available);
  }

  public next(): number {
    let value: number;
    if (this.available.size > 0) {
      value = this.available.values().next().value;
      this.available.delete(value);
      return value;
    }

    return this.counter++;
  }

  public reuse(value: number): void {
    if (value >= this.counter) {
      throw new Error(
        `Cannot reuse value ${value} that is greater than or equal to the current counter value ${this.counter}`
      );
    }
    this.available.add(value);
  }
}
