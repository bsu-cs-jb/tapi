import { Cat } from './cat';
import { urlid, withId } from './genid';
import { assert } from './utils';

interface Database {
  cats: Cat[];
}

const data:Database = {
  cats: [],
}


function initDb() {
  data.cats = [withId({
    id: "",
    name: "Oscar",
    age: 10,
    claws: true,
  }),withId({
    id: "",
    name: "Charles",
    age: 4,
    claws: false,
  }),
  withId({
    id: "",
    name: "Charles",
    age: 4,
    claws: true,
  })
  ]
}
initDb();

export function allCats():Cat[] {
  return data.cats;
}

export function getCat(id:string) : Cat|undefined {
  return data.cats.find((cat) => cat.id === id);
}

export function insertCat(cat:Cat):Cat {
  if (!cat.id) {
    cat.id = urlid();
  }
  assert(!getCat(cat.id));

  data.cats.push(cat);

  return cat;
}
