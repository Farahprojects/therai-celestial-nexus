// Direct Bars Animation Service
// Publishes per-frame levels for 4 bars without involving React state

export type FourBarLevels = [number, number, number, number];

export class DirectBarsAnimationService {
  private listeners = new Set<(levels: FourBarLevels) => void>();
  private isProcessing = false;
  private isPaused = false;
  private currentLevels: FourBarLevels = [0.2, 0.2, 0.2, 0.2]; // Start at minimum scale

  public subscribe(listener: (levels: FourBarLevels) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyBars(levels: FourBarLevels): void {
    this.currentLevels = levels;
    if (this.isProcessing && !this.isPaused) {
      this.listeners.forEach((listener) => listener(levels));
    }
  }

  public getCurrentLevels(): FourBarLevels {
    return this.currentLevels;
  }

  public start(): void {
    this.isProcessing = true;
    this.isPaused = false;
  }

  public stop(): void {
    this.isProcessing = false;
    this.isPaused = false;
    this.currentLevels = [0.2, 0.2, 0.2, 0.2]; // Return to minimum scale
    this.listeners.forEach((listener) => listener(this.currentLevels));
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}

export const directBarsAnimationService = new DirectBarsAnimationService();


