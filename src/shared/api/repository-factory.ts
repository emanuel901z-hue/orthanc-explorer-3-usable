import { IStudyRepository } from './interfaces/study-repository.interface';
import { DemoStudyRepository } from './mock/demo-study-repository';
import { OrthancStudyRepository } from './orthanc-study-repository';

// Singleton instances
let studyRepo: IStudyRepository | null = null;

export class RepositoryFactory {
  private static useDemoData = false;

  static createStudyRepository(): IStudyRepository {
    if (!studyRepo) {
      if (this.useDemoData) {
        studyRepo = new DemoStudyRepository();
      } else {
        studyRepo = new OrthancStudyRepository();
      }
    }
    return studyRepo;
  }

  static setUseDemoData(value: boolean) {
    this.useDemoData = value;
    studyRepo = null; // Reset to re-create
  }
}
