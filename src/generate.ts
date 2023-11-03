import { Cat } from './cat';
import { urlid, withId } from './genid';
import { range } from './utils';
import { faker } from '@faker-js/faker';

export function genCat():Cat {
  const sex = faker.person.sexType();

  return withId({
    name: faker.person.firstName(sex),
    breed: faker.animal.cat(),
    sex,
    age: faker.number.int(15),
    claws: faker.datatype.boolean(),
  });
}

export function genCats(length: number=10):Cat[] {
  const cats:Cat[] = range(length).map(() => genCat());
  return cats;
}
