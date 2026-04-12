import { IStudyRepository } from './interfaces/study-repository.interface';
import { DemoStudyRepository } from './mock/demo-study-repository';

// Singleton instances
let studyRepo: IStudyRepository | null = null;

export class RepositoryFactory {
  private static useDemoData = true;

  static createStudyRepository(): IStudyRepository {
    if (!studyRepo) {
      if (this.useDemoData) {
        studyRepo = new DemoStudyRepository();
      } else {
        // Future: return new OrthancStudyRepository(orthancClient);
        studyRepo = new DemoStudyRepository();
      }
    }
    return studyRepo;
  }

  static setUseDemoData(value: boolean) {
    this.useDemoData = value;
    studyRepo = null; // Reset to re-create
  }
}
