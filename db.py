import sqlite3
import sys
import json

import gensim.models.word2vec
from gensim.test.utils import datapath
from gensim import utils
import numpy as np

import gensim.downloader as api

def open_db(name):
    return sqlite3.connect(name)

def close_db(conn):
    conn.commit()
    conn.close()

def query_occupation(conn, onetsoc_code):
    query = """
        SELECT
            occupation_data.title,
            occupation_data.description
        FROM
            occupation_data
        WHERE
            occupation_data.onetsoc_code = ?
    """

    cur = conn.cursor()
    res = cur.execute(query, (onetsoc_code,))
    row = res.fetchone()
    return row[0], row[1] if row is not None else None

def get_one_column(cur):
    things = []
    for row in cur:
        things.append(row[0])
    return list(dict.fromkeys(things))

def get_two_columns(cur):
    things = []
    for row in cur:
        things.append(row[0] + ": " + row[1])
    return list(dict.fromkeys(things))

def query_alternate_titles(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            alternate_titles.alternate_title
        FROM
            occupation_data
        INNER JOIN alternate_titles ON occupation_data.onetsoc_code = alternate_titles.onetsoc_code
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_technology_skills(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            unspsc_reference.commodity_title
        FROM
            occupation_data
        INNER JOIN technology_skills ON occupation_data.onetsoc_code = technology_skills.onetsoc_code
        INNER JOIN unspsc_reference ON technology_skills.commodity_code = unspsc_reference.commodity_code
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_tools_used(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            unspsc_reference.commodity_title
        FROM
            occupation_data
        INNER JOIN tools_used ON occupation_data.onetsoc_code = tools_used.onetsoc_code
        INNER JOIN unspsc_reference ON tools_used.commodity_code = unspsc_reference.commodity_code
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_tasks(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            task_statements.task
        FROM
            occupation_data
        INNER JOIN task_statements ON occupation_data.onetsoc_code = task_statements.onetsoc_code
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_related_occupations(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            occupation_data.title
        FROM
            occupation_data
        INNER JOIN related_occupations ON occupation_data.onetsoc_code = related_occupations.related_onetsoc_code
        WHERE related_occupations.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_interests(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN interests ON occupation_data.onetsoc_code = interests.onetsoc_code
        INNER JOIN content_model_reference ON interests.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_skills(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN skills ON occupation_data.onetsoc_code = skills.onetsoc_code
        INNER JOIN content_model_reference ON skills.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_education_training_experience(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN education_training_experience ON occupation_data.onetsoc_code = education_training_experience.onetsoc_code
        INNER JOIN content_model_reference ON education_training_experience.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_work_context(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name
        FROM
            occupation_data
        INNER JOIN work_context ON occupation_data.onetsoc_code = work_context.onetsoc_code
        INNER JOIN scales_reference ON work_context.scale_id = scales_reference.scale_id
        INNER JOIN content_model_reference ON work_context.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_one_column(cur)

def query_knowledge(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN knowledge ON occupation_data.onetsoc_code = knowledge.onetsoc_code
        INNER JOIN content_model_reference ON knowledge.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_work_activities(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN work_activities ON occupation_data.onetsoc_code = work_activities.onetsoc_code
        INNER JOIN content_model_reference ON work_activities.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_abilities(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN abilities ON occupation_data.onetsoc_code = abilities.onetsoc_code
        INNER JOIN content_model_reference ON abilities.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_work_values(conn, onetsoc_code):
    cur = conn.cursor()

    query = """
        SELECT
            content_model_reference.element_name,
            content_model_reference.description
        FROM
            occupation_data
        INNER JOIN work_values ON occupation_data.onetsoc_code = work_values.onetsoc_code
        INNER JOIN content_model_reference ON work_values.element_id = content_model_reference.element_id
        WHERE occupation_data.onetsoc_code = ?
    """

    cur.execute(query, (onetsoc_code,))
    return get_two_columns(cur)

def query_one_occupation(conn, onetsoc_code):

    occupation = {}

    occupation['onetsoc_code'] = onetsoc_code

    occupation["title"], occupation["description"] = query_occupation(conn, onetsoc_code)

    occupation["alternate_titles"] = query_alternate_titles(conn, onetsoc_code)

    occupation["technology_skills"] = query_technology_skills(conn, onetsoc_code)

    occupation["tools_used"] = query_tools_used(conn, onetsoc_code)

    occupation["tasks"] = query_tasks(conn, onetsoc_code)

    occupation["related_occupations"] = query_related_occupations(conn, onetsoc_code)

    occupation["interests"] = query_interests(conn, onetsoc_code)

    occupation["skills"] = query_skills(conn, onetsoc_code)

    occupation["education_training_experience"] = query_education_training_experience(conn, onetsoc_code)

    occupation["knowledge"] = query_knowledge(conn, onetsoc_code)

    occupation["work_activities"] = query_work_activities(conn, onetsoc_code)

    occupation["work_context"] = query_work_context(conn, onetsoc_code)

    occupation["abilities"] = query_abilities(conn, onetsoc_code)

    occupation["work_values"] = query_work_values(conn, onetsoc_code)

    return occupation

def print_occupation(occupation):
    print("Id: {}".format(occupation["onetsoc_code"]))
    print("Title: " + occupation["title"])
    print("Description: " + occupation["description"])
    print("Technology Skills: " + str(occupation["technology_skills"]))
    print("Tools Used: " + str(occupation["tools_used"]))
    print("Tasks: " + str(occupation["tasks"]))
    print("Related Occupations: " + str(occupation["related_occupations"]))
    print("Interests: " + str(occupation["interests"]))
    print("Skills: " + str(occupation["skills"]))
    print("Education Training Experience: " + str(occupation["education_training_experience"]))
    print("Knowledge: " + str(occupation["knowledge"]))
    print("Work Activities: " + str(occupation["work_activities"]))
    print("Work Context: " + str(occupation["work_context"]))
    print("Abilities: " + str(occupation["abilities"]))
    print("Work Values: " + str(occupation["work_values"]))

def occupation_to_document(occupation):
    document = occupation["onetsoc_code"]
    document += " " + occupation["title"]
    document += " " + occupation["description"]
    document += " " + " ".join(occupation["technology_skills"])
    document += " " + " ".join(occupation["tools_used"])
    document += " " + " ".join(occupation["tasks"])
    document += " " + " ".join(occupation["related_occupations"])
    document += " " + " ".join(occupation["interests"])
    document += " " + " ".join(occupation["skills"])
    document += " " + " ".join(occupation["education_training_experience"])
    document += " " + " ".join(occupation["knowledge"])
    document += " " + " ".join(occupation["work_activities"])
    document += " " + " ".join(occupation["work_context"])
    document += " " + " ".join(occupation["abilities"])
    document += " " + " ".join(occupation["work_values"])
    return document

def occupation_to_document2(occupation):
    document = occupation["description"]
    document += " ".join(occupation["related_occupations"])
    #document = occupation["title"]
    #document += " " + occupation["description"]
    #document += " " + " ".join(occupation["technology_skills"])
    #document += " " + " ".join(occupation["tools_used"])
    #document += " " + " ".join(occupation["tasks"])
    #document += " " + " ".join(occupation["interests"])
    #document += " " + " ".join(occupation["education_training_experience"])
    #document += " " + " ".join(occupation["knowledge"])
    #document += " " + " ".join(occupation["work_activities"])
    #document += " " + " ".join(occupation["work_context"])
    #document += " " + " ".join(occupation["abilities"])
    #document += " " + " ".join(occupation["work_values"])
    return document

class corpus_iter:
    """An iterator that ields lists of str."""

    def __init__(self, db_path):
        self.db_path = db_path

    def __iter__(self):
        conn = open_db(self.db_path)

        cur = conn.cursor()
        n = 0
        result = cur.execute("SELECT onetsoc_code FROM occupation_data;")
        for row in result:
            yield utils.simple_preprocess(occupation_to_document(query_one_occupation(conn, row[0])))
            n += 1
            if n % 100 == 0:
                print("Processed " + str(n) + " documents.")

def train_word2vec_model(conn):
    sentences = corpus_iter(conn)
    return gensim.models.Word2Vec(sentences=sentences)

def train_doc2vec_model(conn):
    cur = conn.cursor()
    n = 0
    query_result = cur.execute("SELECT onetsoc_code FROM occupation_data;")
    output = []
    for row in query_result:
        onetsoc_code = row[0]
        doc = occupation_to_document2(query_one_occupation(conn, onetsoc_code))
        output.append(gensim.models.doc2vec.TaggedDocument(utils.simple_preprocess(doc), [onetsoc_code]))
        n += 1
        if n % 100 == 0:
            print("Processed " + str(n) + " documents.")
    
    model = gensim.models.Doc2Vec(min_count=1, epochs=100)
    model.build_vocab(output)
    model.train(output, total_examples=model.corpus_count, epochs=model.epochs)
    return model

def save_model(model, filename):
    model.save(filename)

def load_model(filename):
    return gensim.models.Word2Vec.load(filename)

def load_doc2vec_model(filename):
    return gensim.models.Doc2Vec.load(filename)

def main() -> int:

    if len(sys.argv) < 2:
        print("Usage: python query.py <cmd> <onetsoc_code>")
        return 1

    conn = open_db("onet.db")

    if sys.argv[1] == "print_one":
        print_occupation(query_one_occupation(conn, sys.argv[2]))
    elif sys.argv[1] == "print_all" or sys.argv[1] == "print_all_json":
        query = """
            SELECT
                occupation_data.onetsoc_code
            FROM
                occupation_data;
        """
        cur = conn.cursor()
        cur.execute(query)
        occupations = []
        for row in cur:
            occupation = query_one_occupation(conn, row[0])
            if sys.argv[1] == "print_all":
                print_occupation(occupation)
            elif sys.argv[1] == "print_all_json":
                occupations.append(occupation)
        if sys.argv[1] == "print_all_json":
            print(json.dumps(occupations, indent=4))
    elif sys.argv[1] == "train_word2vec":
        model = train_word2vec_model("onet.db")
        save_model(model, sys.argv[2])
    elif sys.argv[1] == "load_word2vec":
        model = load_model(sys.argv[2])
        print(model.wv.most_similar(sys.argv[3]))
    elif sys.argv[1] == "load_word2vec_enumerate_vocabulary":
        model = load_model(sys.argv[2])
        for index, word in enumerate(model.wv.index_to_key):
            print(f"word #{index}/{len(model.wv.index_to_key)} is {word}")
    elif sys.argv[1] == "download_train_text8_corpora":
        corpus = api.load('text8')
        model = gensim.models.Word2Vec(corpus)
        save_model(model, sys.argv[2])
    elif sys.argv[1] == "load_text8_corpora":
        model = load_model(sys.argv[2])
        # note model.wv.similarity('france', 'spain') will return a similarity score
        print(model.wv.most_similar(sys.argv[3]))
    elif sys.argv[1] == "train_save_doc2vec":
        model = train_doc2vec_model(conn)
        save_model(model, sys.argv[2])
    elif sys.argv[1] == "infer_doc2vec_words":
        model = load_doc2vec_model(sys.argv[2])
        print(model.infer_vector(sys.argv[3].split(" ")))
    elif sys.argv[1] == "infer_doc2vec_occupation":
        model = load_doc2vec_model(sys.argv[2])
        print(model.infer_vector(occupation_to_document(query_one_occupation(conn, sys.argv[3])).split(" ")))
    elif sys.argv[1] == "infer_doc2vec_most_similar":

        # Ok, if we don't have a vector, the first we need to do is create one as a copy of the winner of their first choice.
        # Then, for every choice we move the components of their vector in the direction of the winner of their choice.
        # When they are done we need to fetch jobs nearby their vector with similar_by_vector().

        model = load_doc2vec_model(sys.argv[2])
        query = """
            SELECT
                occupation_data.onetsoc_code
            FROM
                occupation_data;
        """
        cur = conn.cursor()
        cur.execute(query)
        occupations = []
        for row in cur:
            occ_1 = query_one_occupation(conn, row[0])
            print(occ_1["title"])
            similar = model.dv.most_similar(row[0])

            for i in range(0, len(similar)):
                occ_2 = query_one_occupation(conn, similar[i][0])
                print(occ_2['title'] + ', ', end='')
            print()
            print()

            # model.dv[row[0]] to access the vector for the given occupation
            # model.dv[similar[0][0]] to access the vector for the most similar occupation

        # use similar_by_vec() to find the most similar by vector
    elif sys.argv[1] == "job_game":
        model = load_doc2vec_model(sys.argv[2])
        query = """
            SELECT
                occupation_data.onetsoc_code
            FROM
                occupation_data
            ORDER BY
                RANDOM()
        """
        cur = conn.cursor()
        cur.execute(query)
        occupation_ids = cur.fetchall()
        target_vector = None
        for i in range(0, len(occupation_ids), 2):
            occ_id = occupation_ids[i][0]

            this_occ = query_one_occupation(conn, occ_id)
            last_occ = query_one_occupation(conn, occupation_ids[i+1][0])
            print("Which do you prefer (1) " + last_occ["title"] + " or (2) " + this_occ["title"] + "?")
            choice = input()
            choice_vector = None
            if choice == "1":
                choice_vector = model.dv[occupation_ids[i+1][0]].copy()
                if target_vector is None:
                    target_vector = model.dv[occupation_ids[i+1][0]].copy()
            elif choice == "2":
                choice_vector = model.dv[occ_id].copy()
                if target_vector is None:
                    target_vector = model.dv[occ_id].copy()
            elif choice == "3":
                print("target_vector sum : " + str(sum(target_vector)))
                similar = model.dv.similar_by_vector(target_vector)
                num_similar = len(similar)
                for i in range(0, num_similar):
                    simmilar_occ = query_one_occupation(conn, similar[i][0])
                    print(simmilar_occ["title"], end=', ' if i < (num_similar-1) else '\n')

            if choice_vector is not None:
                target_vector = target_vector + ((choice_vector - target_vector) * 0.25)

            if target_vector is not None:
                print("target_vector sum : " + str(sum(target_vector)))


    close_db(conn)

    return 0

if __name__ == '__main__':
    sys.exit(main())
