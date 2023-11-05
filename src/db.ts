import { Cat } from './cat';
import { urlid, withId } from './genid';
import { assert } from './utils';
import { genCats } from './generate';
import { Rubric } from 'grading';

interface Assignment {
}

interface Student {
  id: string;
  name: string;

}

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
  }),
  ...genCats(10),
  ]
}
initDb();

export function allCats():Cat[] {
  return data.cats;
}

export function getCat(id:string) : Cat|undefined {
  return data.cats.find((cat) => cat.id === id);
}

function replaceCat(newCat: Cat): void {
  data.cats = data.cats.map((cat) => (
    cat.id === newCat.id ? newCat : cat
  ));
}

export function updateCat(updatedCat:Cat) : Cat|undefined {
  const cat = getCat(updatedCat.id);
  if (!cat) {
    return;
  }
  const newCat = {
    ...cat,
    ...updatedCat,
  };
  replaceCat(newCat);
  return newCat;
}

export function insertCat(cat:Cat):Cat {
  if (!cat.id) {
    cat.id = urlid();
  }
  assert(!getCat(cat.id));

  data.cats.push(cat);

  return cat;
}


