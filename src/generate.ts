import { Cat } from "./cat.js";
import { withId } from "./utils/hash.js";
import { range } from "./utils.js";
import { faker } from "@faker-js/faker";

export function genCat(): Cat {
  const sex = faker.person.sexType();

  return withId({
    name: faker.person.firstName(sex),
    breed: faker.animal.cat(),
    sex,
    age: faker.number.int(15),
    claws: faker.datatype.boolean(),
  });
}

export function genCats(length: number = 10): Cat[] {
  // TEMP: Maybe remove seed here
  faker.seed(1138);
  const cats: Cat[] = range(length).map(() => genCat());
  return cats;
}
